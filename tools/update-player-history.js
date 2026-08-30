#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const COMPETITIONS_PATH = path.join(ROOT, 'data', 'competitions.json');
const PROFILES_PATH = path.join(ROOT, 'data', 'player-profiles.json');
const IDENTITIES_PATH = path.join(ROOT, 'data', 'team-identities.json');
const NATIONAL_IDENTITIES_PATH = path.join(ROOT, 'data', 'national-team-identities.json');

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
  return function canonicalName(name) {
    const raw = String(name || '').trim();
    if (!raw) return raw;
    return lookup.get(normalizeText(raw)) || raw;
  };
}

function squadFilesForTarget(competitions) {
  if (target === 'all') {
    return [...new Set(Object.values(competitions).map((c) => c?.files?.squads).filter(Boolean))];
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
  const queue = [payload];
  const seen = new Set();
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (node.careerHistory) return node;
    for (const child of Object.values(node)) if (child && typeof child === 'object') queue.push(child);
  }
  return payload;
}

function extractCareerGroup(payload, groupName) {
  const player = unwrapPlayer(payload);
  const items = player?.careerHistory?.careerItems || {};
  const keys = Object.keys(items);
  const wanted = normalizeText(groupName);
  const key = keys.find((k) => normalizeText(k) === wanted);
  const group = key ? items[key] : null;
  if (Array.isArray(group)) return group;
  if (Array.isArray(group?.teamEntries)) return group.teamEntries;
  if (Array.isArray(group?.teams)) return group.teams;
  return [];
}

function normalizeClubCareer(payload, canonicalTeamName) {
  const entries = extractCareerGroup(payload, 'senior');
  return normalizeTimeline(entries, (raw) => canonicalTeamName(raw), 'club');
}

function isYouthOrSecondaryNationalTeam(name) {
  const n = normalizeText(name);
  if (!n) return true;
  return /(?:^| )(u ?(?:15|16|17|18|19|20|21|22|23)|under ?(?:15|16|17|18|19|20|21|22|23)|youth|olympic|olympics|reserve|reserves|b team|ii)(?: |$)/.test(n);
}

function normalizeNationalCareer(payload, canonicalNationalTeamName) {
  const entries = extractCareerGroup(payload, 'national team');
  const seniorOnly = entries.filter((entry) => {
    const raw = entry?.team || entry?.teamName || entry?.name;
    return raw && !isYouthOrSecondaryNationalTeam(raw);
  });
  return normalizeTimeline(seniorOnly, (raw) => canonicalNationalTeamName(raw), 'team');
}

function normalizeTimeline(entries, resolver, nameKey) {
  const timeline = entries.map((entry) => {
    const raw = entry?.team || entry?.teamName || entry?.name;
    if (!raw) return null;
    const start = parseDateYear(entry.startDate || entry.from || entry.start);
    let end = parseDateYear(entry.endDate || entry.to || entry.end);
    if (entry.active === true || entry.current === true) end = null;
    const result = { start, end };
    result[nameKey] = resolver(raw);
    return result;
  }).filter((entry) => entry && entry[nameKey] && entry.start);

  timeline.sort((a, b) => Number(a.start) - Number(b.start) || String(a.end || '9999').localeCompare(String(b.end || '9999')));
  const unique = [];
  const seen = new Set();
  for (const entry of timeline) {
    const key = `${normalizeText(entry[nameKey])}|${entry.start}|${entry.end || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return unique;
}

function sameTimeline(a, b) { return JSON.stringify(a || []) === JSON.stringify(b || []); }
async function sleep(ms) { if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms)); }

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
          accept: 'application/json,text/plain,*/*',
          'accept-language': 'en-US,en;q=0.9',
          'user-agent': 'Mozilla/5.0 PlayerHistoryUpdater/2.0'
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const type = res.headers.get('content-type') || '';
      if (!type.includes('json')) throw new Error(`Expected JSON, received ${type || 'unknown content type'}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await sleep(600 * attempt);
    } finally { clearTimeout(timeout); }
  }
  throw lastErr;
}

function workNeeded(profile) {
  if (!profile) return { club: true, national: true };
  const generated = profile.source === 'fotmob';
  return {
    club: !Array.isArray(profile.career) || (REFRESH && generated),
    national: !profile.nationalHistoryChecked || REFRESH
  };
}

async function main() {
  const competitions = readJson(COMPETITIONS_PATH, {});
  const clubIdentities = readJson(IDENTITIES_PATH, {});
  const nationalIdentities = readJson(NATIONAL_IDENTITIES_PATH, {});
  const canonicalTeamName = buildIdentityResolver(clubIdentities);
  const canonicalNationalTeamName = buildIdentityResolver(nationalIdentities);
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
    if (ambiguousNames.has(normalizeText(p.name))) return false;
    const needed = workNeeded(profiles[p.name]);
    return needed.club || needed.national;
  });
  const selected = LIMIT > 0 ? queue.slice(0, LIMIT) : queue;

  console.log(`PLAYER HISTORY — FotMob refresh (${target})`);
  console.log(WRITE ? 'WRITE MODE — club + senior national-team history will be saved' : 'DRY RUN — no files will be modified');
  console.log('');
  console.log(`Unique players with FotMob IDs: ${players.length}`);
  console.log(`Fully up to date:               ${players.length - queue.length - ambiguousNames.size}`);
  console.log(`Queued for FotMob:             ${selected.length}${LIMIT > 0 && queue.length > selected.length ? ` of ${queue.length}` : ''}`);
  console.log(`Squad rows without FotMob ID:  ${withoutId}`);
  if (ambiguousNames.size) console.log(`Ambiguous duplicate names:     ${ambiguousNames.size} (skipped for safety)`);
  console.log('');

  let fetched = 0, changedCount = 0, unchanged = 0, failed = 0, pendingWrites = 0;
  let clubUpdates = 0, nationalUpdates = 0, noNational = 0;
  const failures = [];

  for (let i = 0; i < selected.length; i += 1) {
    const p = selected[i];
    try {
      const payload = await fotmobFetch(p.id);
      fetched += 1;
      const old = profiles[p.name] || {};
      const needed = workNeeded(old);
      const clubCareer = normalizeClubCareer(payload, canonicalTeamName);
      const nationalCareer = normalizeNationalCareer(payload, canonicalNationalTeamName);

      const next = { ...old };
      let changed = false;

      if (needed.club) {
        if (clubCareer.length && !sameTimeline(old.career, clubCareer)) {
          next.career = clubCareer;
          clubUpdates += 1;
          changed = true;
        }
      }

      if (needed.national) {
        if (!sameTimeline(old.nationalCareer, nationalCareer) || !old.nationalHistoryChecked) {
          next.nationalCareer = nationalCareer;
          next.nationalHistoryChecked = true;
          next.nationalSource = 'fotmob';
          next.nationalUpdatedAt = new Date().toISOString().slice(0, 10);
          nationalUpdates += 1;
          changed = true;
        }
        if (!nationalCareer.length) noNational += 1;
      }

      if (!old.source && !old.career && clubCareer.length) next.source = 'fotmob';
      if (old.source === 'fotmob' || (!old.source && !old.career)) {
        next.source = 'fotmob';
        next.fotmobId = p.id;
        next.updatedAt = new Date().toISOString().slice(0, 10);
      } else if (!next.fotmobId) {
        // Safe additive metadata for hand-curated profiles; their club career is preserved.
        next.fotmobId = p.id;
      }

      if (changed) {
        changedCount += 1;
        if (VERBOSE || PLAYER_NAME || changedCount <= 20) {
          const clubText = needed.club && clubCareer.length ? `${clubCareer.length} club stint(s)` : 'club history preserved';
          const natText = nationalCareer.length ? nationalCareer.map((n) => `${n.team} ${n.start}–${n.end || 'Present'}`).join(' | ') : 'no senior national-team stint';
          console.log(`~ ${p.name} [${p.id}] — ${clubText}; ${natText}`);
        }
        if (WRITE) {
          profiles[p.name] = next;
          pendingWrites += 1;
          if (pendingWrites >= CHECKPOINT_EVERY) {
            writeJson(PROFILES_PATH, profiles);
            pendingWrites = 0;
          }
        }
      } else {
        unchanged += 1;
        if (VERBOSE || PLAYER_NAME) console.log(`= ${p.name} — no history changes`);
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
  console.log(`${changedCount} player profiles changed, ${unchanged} unchanged`);
  console.log(`${clubUpdates} club-history updates, ${nationalUpdates} senior national-team updates`);
  console.log(`${noNational} players returned no senior national-team history, ${failed} failed`);
  if (failures.length) console.log('Failed players are left untouched and can be retried safely.');
  console.log('');
  if (WRITE) {
    console.log(`WRITE complete. Updated ${path.relative(ROOT, PROFILES_PATH)}.`);
    console.log('Hand-curated club careers were preserved; senior national-team history is additive.');
  } else {
    console.log('DRY RUN complete. Re-run with --write to save these histories.');
  }
}

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exitCode = 1;
});
