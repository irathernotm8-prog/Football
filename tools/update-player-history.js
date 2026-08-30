#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const COMPETITIONS_PATH = path.join(ROOT, 'data', 'competitions.json');
const PROFILES_PATH = path.join(ROOT, 'data', 'player-profiles.json');
const IDENTITIES_PATH = path.join(ROOT, 'data', 'team-identities.json');

const args = process.argv.slice(2);
const target = args.find((arg) => !arg.startsWith('--')) || 'all';
const WRITE = args.includes('--write');
const REFRESH = args.includes('--refresh');
const VERBOSE = args.includes('--verbose');
const PLAYER_NAME = getArgValue('--player');
const LIMIT = Number(getArgValue('--limit') || 0);
const DELAY_MS = Math.max(0, Number(getArgValue('--delay') || 300));
const CHECKPOINT_EVERY = Math.max(1, Number(getArgValue('--checkpoint') || 25));

function getArgValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (err) {
    if (err && err.code === 'ENOENT') return fallback;
    throw err;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildIdentityResolver(identities) {
  const lookup = new Map();
  for (const [canonical, data] of Object.entries(identities || {})) {
    lookup.set(normalizeText(canonical), canonical);
    for (const alias of data?.aliases || []) lookup.set(normalizeText(alias), canonical);
  }
  return function canonicalTeamName(name) {
    const raw = String(name || '').trim();
    if (!raw) return raw;
    return lookup.get(normalizeText(raw)) || raw;
  };
}

function squadFilesForTarget(competitions) {
  if (target === 'all') {
    return [...new Set(Object.values(competitions)
      .map((c) => c?.files?.squads)
      .filter(Boolean))];
  }
  const competition = competitions[target];
  if (!competition) throw new Error(`Unknown competition key: ${target}`);
  if (!competition.files?.squads) throw new Error(`${target} has no squad file configured.`);
  return [competition.files.squads];
}

function collectPlayers(squadFiles) {
  const byId = new Map();
  let withoutId = 0;
  for (const relative of squadFiles) {
    const file = path.join(ROOT, relative);
    if (!fs.existsSync(file)) continue;
    const squads = readJson(file, {});
    for (const [team, roster] of Object.entries(squads)) {
      for (const player of Array.isArray(roster) ? roster : []) {
        const id = Number(player?.fotmobId || 0);
        if (!id) { withoutId += 1; continue; }
        if (!byId.has(id)) byId.set(id, { id, name: player.name, currentTeam: team });
      }
    }
  }
  return { players: [...byId.values()], withoutId };
}

function parseDateYear(value) {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value > 1e12 ? value : value * 1000);
    return Number.isNaN(d.getTime()) ? null : String(d.getUTCFullYear());
  }
  const text = String(value).trim();
  const yearMatch = text.match(/(?:^|\D)(19\d{2}|20\d{2})(?:\D|$)/);
  if (yearMatch) return yearMatch[1];
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : String(d.getUTCFullYear());
}

function unwrapPlayer(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload.careerHistory) return payload;
  // Tolerate Next.js/fallback-style wrappers if FotMob changes the route shape.
  const queue = [payload];
  const seen = new Set();
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (node.careerHistory) return node;
    for (const child of Object.values(node)) {
      if (child && typeof child === 'object') queue.push(child);
    }
  }
  return payload;
}

function extractSeniorEntries(payload) {
  const player = unwrapPlayer(payload);
  const career = player?.careerHistory?.careerItems;
  const senior = career?.senior || career?.Senior;
  if (Array.isArray(senior)) return senior;
  if (Array.isArray(senior?.teamEntries)) return senior.teamEntries;
  if (Array.isArray(senior?.teams)) return senior.teams;
  return [];
}

function normalizeCareer(payload, canonicalTeamName) {
  const entries = extractSeniorEntries(payload);
  const career = entries.map((entry) => {
    const clubRaw = entry?.team || entry?.teamName || entry?.name;
    if (!clubRaw) return null;
    const start = parseDateYear(entry.startDate || entry.from || entry.start);
    let end = parseDateYear(entry.endDate || entry.to || entry.end);
    if (entry.active === true || entry.current === true) end = null;
    return {
      club: canonicalTeamName(clubRaw),
      start,
      end
    };
  }).filter((entry) => entry && entry.club && entry.start);

  // Sort chronologically, preserve separate loan/permanent stints, but remove
  // exact duplicates that can occur in hydrated FotMob payloads.
  career.sort((a, b) => Number(a.start) - Number(b.start) || String(a.end || '9999').localeCompare(String(b.end || '9999')));
  const unique = [];
  const seen = new Set();
  for (const entry of career) {
    const key = `${normalizeText(entry.club)}|${entry.start}|${entry.end || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return unique;
}

function sameCareer(a, b) {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}

async function sleep(ms) {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fotmobFetch(playerId) {
  const url = `https://www.fotmob.com/api/data/playerData?id=${playerId}&includeMarketValues=false`;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'accept': 'application/json,text/plain,*/*',
          'accept-language': 'en-US,en;q=0.9',
          'user-agent': 'Mozilla/5.0 PlayerHistoryUpdater/1.0'
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const type = res.headers.get('content-type') || '';
      if (!type.includes('json')) throw new Error(`Expected JSON, received ${type || 'unknown content type'}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await sleep(600 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastErr;
}

function statusForProfile(profile) {
  if (!profile) return 'missing';
  if (profile.source === 'fotmob') return REFRESH ? 'refresh' : 'skip-generated';
  return 'skip-manual';
}

async function main() {
  const competitions = readJson(COMPETITIONS_PATH, {});
  const identities = readJson(IDENTITIES_PATH, {});
  const canonicalTeamName = buildIdentityResolver(identities);
  const profiles = readJson(PROFILES_PATH, {});
  const squadFiles = squadFilesForTarget(competitions);
  let { players, withoutId } = collectPlayers(squadFiles);

  if (PLAYER_NAME) {
    const wanted = normalizeText(PLAYER_NAME);
    players = players.filter((p) => normalizeText(p.name) === wanted);
    if (!players.length) throw new Error(`Player not found in selected squad data: ${PLAYER_NAME}`);
  }

  const duplicateNames = new Map();
  for (const p of players) {
    const key = normalizeText(p.name);
    if (!duplicateNames.has(key)) duplicateNames.set(key, new Set());
    duplicateNames.get(key).add(p.id);
  }
  const ambiguousNames = new Set([...duplicateNames.entries()].filter(([, ids]) => ids.size > 1).map(([name]) => name));

  const queue = players.filter((p) => {
    if (ambiguousNames.has(normalizeText(p.name))) return false; // current UI is name-keyed; don't overwrite ambiguous names.
    const state = statusForProfile(profiles[p.name]);
    return state === 'missing' || state === 'refresh';
  });
  const selected = LIMIT > 0 ? queue.slice(0, LIMIT) : queue;

  console.log(`PLAYER CLUB HISTORY — FotMob refresh (${target})`);
  console.log(WRITE ? 'WRITE MODE — safe player profiles will be saved' : 'DRY RUN — no files will be modified');
  console.log('');
  console.log(`Unique players with FotMob IDs: ${players.length}`);
  console.log(`Already profiled:              ${players.length - queue.length - ambiguousNames.size}`);
  console.log(`Queued for FotMob:             ${selected.length}${LIMIT > 0 && queue.length > selected.length ? ` of ${queue.length}` : ''}`);
  console.log(`Squad rows without FotMob ID:  ${withoutId}`);
  if (ambiguousNames.size) console.log(`Ambiguous duplicate names:     ${ambiguousNames.size} (skipped for safety)`);
  console.log('');

  let fetched = 0;
  let added = 0;
  let refreshed = 0;
  let unchanged = 0;
  let noCareer = 0;
  let failed = 0;
  let pendingWrites = 0;
  const changes = [];
  const failures = [];

  for (let i = 0; i < selected.length; i += 1) {
    const p = selected[i];
    try {
      const payload = await fotmobFetch(p.id);
      fetched += 1;
      const career = normalizeCareer(payload, canonicalTeamName);
      if (!career.length) {
        noCareer += 1;
        if (VERBOSE || PLAYER_NAME) console.log(`! ${p.name} [${p.id}] — no senior club history returned`);
      } else {
        const old = profiles[p.name];
        const changed = !old || !sameCareer(old.career, career);
        if (!changed) {
          unchanged += 1;
          if (VERBOSE || PLAYER_NAME) console.log(`= ${p.name} — ${career.length} club stint(s), no change`);
        } else {
          if (old) refreshed += 1; else added += 1;
          changes.push({ name: p.name, id: p.id, career });
          if (VERBOSE || PLAYER_NAME || changes.length <= 20) {
            console.log(`${old ? '~' : '+'} ${p.name} [${p.id}] — ${career.map((c) => `${c.club} ${c.start}–${c.end || 'Present'}`).join(' | ')}`);
          }
          if (WRITE) {
            profiles[p.name] = {
              career,
              source: 'fotmob',
              fotmobId: p.id,
              updatedAt: new Date().toISOString().slice(0, 10)
            };
            pendingWrites += 1;
            if (pendingWrites >= CHECKPOINT_EVERY) {
              writeJson(PROFILES_PATH, profiles);
              pendingWrites = 0;
            }
          }
        }
      }
    } catch (err) {
      failed += 1;
      failures.push({ name: p.name, id: p.id, error: err.message });
      console.log(`! ${p.name} [${p.id}] — ${err.message}`);
    }

    if (i < selected.length - 1) await sleep(DELAY_MS);
  }

  if (WRITE && pendingWrites > 0) writeJson(PROFILES_PATH, profiles);

  console.log('');
  console.log('----------------------------------------');
  console.log(`${fetched} player profiles fetched`);
  console.log(`${added} histories added, ${refreshed} refreshed, ${unchanged} unchanged`);
  console.log(`${noCareer} returned no senior club history, ${failed} failed`);
  if (changes.length > 20 && !VERBOSE && !PLAYER_NAME) console.log(`${changes.length - 20} additional changes omitted (use --verbose to show all)`);
  if (failures.length) console.log('Failed players are left untouched and can be retried safely.');
  console.log('');
  if (WRITE) {
    console.log(`WRITE complete. Updated ${path.relative(ROOT, PROFILES_PATH)}.`);
    console.log('Hand-curated profiles were preserved. Re-run to continue any remaining missing players.');
  } else {
    console.log('DRY RUN complete. Re-run with --write to save these histories.');
  }
}

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exitCode = 1;
});
