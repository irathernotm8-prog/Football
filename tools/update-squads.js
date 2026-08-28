#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'fotmob-squads.json');
const OVERRIDES_PATH = path.join(__dirname, 'squad-overrides.json');
const COMPETITIONS_PATH = path.join(ROOT, 'data', 'competitions.json');

const args = process.argv.slice(2);
const target = args.find((arg) => !arg.startsWith('--')) || 'ligue1';
const WRITE = args.includes('--write');
const VERBOSE = args.includes('--verbose');
const ONLY_TEAM = getArgValue('--team');
const MAX_REMOVAL_RATIO = Number(getArgValue('--max-removal-ratio') || 0.35);
const MIN_SQUAD_SIZE = Number(getArgValue('--min-squad-size') || 15);

function getArgValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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

function sameName(a, b) {
  return normalizeText(a) === normalizeText(b);
}

function pick(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return null;
}

function extractFotmobIdFromPhoto(photo) {
  const match = String(photo || '').match(/playerimages\/(\d+)\.png/i);
  return match ? Number(match[1]) : null;
}

function positionFromGroup(groupTitle) {
  const t = normalizeText(groupTitle);
  if (/(keeper|goalkeeper)/.test(t)) return 'GK';
  if (/defen/.test(t)) return 'DEFENDER';
  if (/midfield/.test(t)) return 'MIDFIELDER';
  if (/(attack|forward|striker)/.test(t)) return 'FORWARD';
  return null;
}

function normalizePosition(raw, groupTitle, existingPosition) {
  const original = String(raw || '').trim();
  const t = normalizeText(original);
  const mappings = [
    [/^(gk|goalkeeper|keeper)$/, 'GK'],
    [/(right back|rightback|rwb)/, 'RB'],
    [/(left back|leftback|lwb)/, 'LB'],
    [/(centre back|center back|centreback|centerback|cb)/, 'CB'],
    [/(defensive midfield|defensive midfielder|holding midfield|dm)/, 'DM'],
    [/(central midfield|central midfielder|centre midfield|cm)/, 'CM'],
    [/(attacking midfield|attacking midfielder|number 10|am)/, 'AM'],
    [/(right wing|right winger|rw)/, 'RW'],
    [/(left wing|left winger|lw)/, 'LW'],
    [/(centre forward|center forward|striker|cf|st)/, 'ST'],
    [/^defender$/, 'DEFENDER'],
    [/^midfielder$/, 'MIDFIELDER'],
    [/^(forward|attacker)$/, 'FORWARD']
  ];
  for (const [pattern, code] of mappings) {
    if (pattern.test(t)) return code;
  }

  const grouped = positionFromGroup(groupTitle);
  if (grouped) {
    // Preserve a more specific hand-curated position when FotMob only gives a broad group.
    const broad = new Set(['DEFENDER', 'MIDFIELDER', 'FORWARD']);
    if (existingPosition && !broad.has(existingPosition) && existingPosition !== 'GK' && grouped !== 'GK') {
      return existingPosition;
    }
    return grouped;
  }
  return existingPosition || 'MIDFIELDER';
}

function countryName(member) {
  const country = member?.country || member?.nationality || member?.countryName;
  if (!country) return null;
  if (typeof country === 'string') return country;
  return pick(country, ['name', 'countryName', 'shortName', 'code']);
}

function broadPosition(position) {
  return ['DEFENDER', 'MIDFIELDER', 'FORWARD'].includes(position);
}

function findFirstValueByKeys(node, keys, maxDepth = 5) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const seen = new Set();

  function walk(value, depth) {
    if (!value || typeof value !== 'object' || depth > maxDepth || seen.has(value)) return null;
    seen.add(value);

    if (!Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (wanted.has(key.toLowerCase()) && child !== undefined && child !== null && child !== '') {
          return child;
        }
      }
    }

    const children = Array.isArray(value) ? value : Object.values(value);
    for (const child of children) {
      const found = walk(child, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }

  return walk(node, 0);
}

function countryFromPlayerData(payload) {
  const raw = findFirstValueByKeys(payload, [
    'nationality', 'country', 'countryName', 'birthCountry', 'citizenship'
  ]);
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') return pick(raw, ['name', 'countryName', 'shortName', 'code']);
  return null;
}

function positionFromPlayerData(payload, existingPosition) {
  const raw = findFirstValueByKeys(payload, [
    'positionDescription', 'positionName', 'primaryPosition', 'position', 'role'
  ]);
  if (!raw) return existingPosition;

  let value = raw;
  if (typeof raw === 'object') {
    value = pick(raw, ['description', 'name', 'position', 'abbreviation', 'code']);
  }
  if (!value) return existingPosition;

  return normalizePosition(value, null, existingPosition);
}

async function enrichPlayer(player, globalConfig) {
  if (!player?.fotmobId) return player;
  const needsCountry = !player.nationality;
  const needsPosition = broadPosition(player.position);
  if (!needsCountry && !needsPosition) return player;

  const url = `${globalConfig.baseUrl}/playerData?id=${player.fotmobId}`;
  const payload = await fotmobFetch(url);
  const enriched = { ...player };

  if (needsCountry) enriched.nationality = countryFromPlayerData(payload) || player.nationality || null;
  if (needsPosition) {
    const candidate = positionFromPlayerData(payload, player.position);
    if (candidate && !broadPosition(candidate)) enriched.position = candidate;
  }

  return enriched;
}

async function enrichSquad(players, globalConfig, teamName) {
  const result = [];
  for (const player of players) {
    if (!player?.fotmobId || (player.nationality && !broadPosition(player.position))) {
      result.push(player);
      continue;
    }
    try {
      result.push(await enrichPlayer(player, globalConfig));
    } catch (error) {
      if (VERBOSE) console.log(`  Enrichment skipped for ${teamName} / ${player.name}: ${error.message}`);
      result.push(player);
    }
  }
  return result.sort(sortPlayers);
}

function looksLikeStaff(member) {
  if (!member || typeof member !== 'object') return false;
  const staffText = normalizeText([
    pick(member, ['type', 'entityType', 'memberType']),
    pick(member, ['role', 'job', 'title', 'position', 'positionDescription', 'positionName'])
  ].filter(Boolean).join(' '));
  return /(coach|manager|staff|head coach|assistant coach|technical staff)/.test(staffText);
}

function looksLikePlayer(member) {
  if (!member || typeof member !== 'object' || looksLikeStaff(member)) return false;
  const name = pick(member, ['name', 'fullName', 'playerName']);
  if (!name) return false;

  // FotMob staff records can also have a name + numeric id. Require at least
  // one player-specific field instead of treating every named/id'd member as a player.
  const hasPlayerSignal = [
    'shirtNumber', 'number', 'jerseyNumber',
    'position', 'role', 'positionDescription', 'positionName'
  ].some((key) => member[key] !== undefined && member[key] !== null && member[key] !== '');

  return hasPlayerSignal;
}

function squadGroups(payload) {
  const candidates = [];
  const seen = new Set();

  function walk(node, keyName = '') {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      const playerCount = node.filter(looksLikePlayer).length;
      if (playerCount >= 5) candidates.push({ title: keyName, members: node });
      for (const item of node) walk(item, keyName);
      return;
    }

    if (Array.isArray(node.members)) {
      const playerCount = node.members.filter(looksLikePlayer).length;
      if (playerCount >= 1) {
        candidates.push({ title: pick(node, ['title', 'name', 'position', 'role']) || keyName, members: node.members });
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (/coach|manager|staff/i.test(key)) continue;
      walk(value, key);
    }
  }

  if (payload?.squad) walk(payload.squad, 'squad');
  if (payload?.content?.squad) walk(payload.content.squad, 'squad');
  if (payload?.details?.squad) walk(payload.details.squad, 'squad');
  if (!candidates.length) walk(payload, 'root');

  // Prefer grouped squad data; collapse duplicates later by player ID/name.
  return candidates;
}

function existingLookup(players) {
  const byId = new Map();
  const byName = new Map();
  for (const player of players || []) {
    const id = player.fotmobId || extractFotmobIdFromPhoto(player.photo);
    if (id) byId.set(Number(id), player);
    if (player.name) byName.set(normalizeText(player.name), player);
  }
  return { byId, byName };
}

function normalizeSquad(payload, existingPlayers, imageBaseUrl, overrideMap = {}) {
  const groups = squadGroups(payload);
  const existing = existingLookup(existingPlayers);
  const out = new Map();

  for (const group of groups) {
    if (/(coach|manager|staff)/.test(normalizeText(group.title))) continue;
    for (const member of group.members) {
      if (!looksLikePlayer(member)) continue;
      const roleText = normalizeText(pick(member, ['role', 'position', 'positionDescription', 'positionName']));
      if (/(coach|manager|staff)/.test(roleText)) continue;

      const id = Number(pick(member, ['id', 'playerId'])) || null;
      const name = pick(member, ['name', 'fullName', 'playerName']);
      if (!name) continue;
      const old = (id && existing.byId.get(id)) || existing.byName.get(normalizeText(name)) || {};
      const override = overrideMap[String(id)] || overrideMap[name] || {};
      const numberValue = pick(member, ['shirtNumber', 'number', 'jerseyNumber']);
      let number;
      if (numberValue === null) {
        number = old.number ?? null;
      } else {
        const parsedNumber = Number(numberValue);
        // FotMob uses 0 for "no assigned squad number". Store that as null.
        number = Number.isFinite(parsedNumber) && parsedNumber > 0 ? parsedNumber : null;
      }
      const rawPosition = pick(member, ['positionDescription', 'positionName', 'position', 'role']);

      const player = {
        fotmobId: id || old.fotmobId || extractFotmobIdFromPhoto(old.photo) || null,
        number,
        name,
        position: normalizePosition(rawPosition, group.title, old.position),
        nationality: countryName(member) || old.nationality || null,
        photo: id ? `${imageBaseUrl}/${id}.png` : (old.photo || null)
      };

      Object.assign(player, override);
      const key = player.fotmobId ? `id:${player.fotmobId}` : `name:${normalizeText(player.name)}`;
      const previous = out.get(key);
      if (!previous || specificity(player.position) >= specificity(previous.position)) out.set(key, player);
    }
  }

  return [...out.values()].sort(sortPlayers);
}

function specificity(position) {
  if (position === 'GK') return 3;
  if (['DEFENDER', 'MIDFIELDER', 'FORWARD'].includes(position)) return 1;
  return 2;
}

function sortPlayers(a, b) {
  const order = { GK: 0, RB: 1, CB: 2, LB: 3, DEFENDER: 4, DM: 5, CM: 6, AM: 7, MIDFIELDER: 8, RW: 9, LW: 10, ST: 11, FORWARD: 12 };
  const pa = order[a.position] ?? 99;
  const pb = order[b.position] ?? 99;
  if (pa !== pb) return pa - pb;
  const na = a.number ?? 999;
  const nb = b.number ?? 999;
  if (na !== nb) return na - nb;
  return a.name.localeCompare(b.name);
}

async function fotmobFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'accept': 'application/json,text/plain,*/*',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 SquadUpdater/1.0'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const type = res.headers.get('content-type') || '';
    if (!type.includes('json')) {
      const text = await res.text();
      throw new Error(`Expected JSON, received ${type || 'unknown content type'} (${text.slice(0, 80)})`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function findTeamSuggestions(payload) {
  const results = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const type = normalizeText(node.type || node.entityType || node.suggestionType);
    const id = Number(node.id || node.teamId || node.entityId);
    const name = node.name || node.title || node.teamName;
    if (id && name && (!type || type.includes('team'))) results.push({ id, name });
    Object.values(node).forEach(walk);
  }
  walk(payload);
  const unique = new Map(results.map((r) => [r.id, r]));
  return [...unique.values()];
}

async function resolveTeamId(teamName, teamConfig, config) {
  if (teamConfig.fotmobId) return Number(teamConfig.fotmobId);
  const term = encodeURIComponent(teamConfig.search || teamName);
  const url = `${config.baseUrl}/search/suggest?hits=20&lang=en&term=${term}`;
  const payload = await fotmobFetch(url);
  const candidates = findTeamSuggestions(payload);
  if (!candidates.length) throw new Error(`No FotMob team search result for "${teamConfig.search || teamName}"`);

  const wanted = normalizeText(teamConfig.search || teamName);
  const exact = candidates.find((c) => normalizeText(c.name) === wanted);
  if (exact) return exact.id;

  const close = candidates.find((c) => normalizeText(c.name).includes(wanted) || wanted.includes(normalizeText(c.name)));
  if (close) return close.id;

  throw new Error(`Ambiguous FotMob team search for "${teamConfig.search || teamName}": ${candidates.slice(0, 5).map((c) => `${c.name} (${c.id})`).join(', ')}`);
}

function diffSquads(oldPlayers, newPlayers) {
  const oldLookup = existingLookup(oldPlayers);
  const newLookup = existingLookup(newPlayers);
  const added = [];
  const removed = [];
  const changed = [];

  const matchNew = (old) => {
    const id = old.fotmobId || extractFotmobIdFromPhoto(old.photo);
    return (id && newLookup.byId.get(Number(id))) || newLookup.byName.get(normalizeText(old.name));
  };
  const matchOld = (neu) => {
    const id = neu.fotmobId || extractFotmobIdFromPhoto(neu.photo);
    return (id && oldLookup.byId.get(Number(id))) || oldLookup.byName.get(normalizeText(neu.name));
  };

  for (const neu of newPlayers) {
    const old = matchOld(neu);
    if (!old) {
      added.push(neu);
      continue;
    }
    const fields = ['number', 'name', 'position', 'nationality', 'photo'];
    const deltas = fields.filter((field) => (old[field] ?? null) !== (neu[field] ?? null));
    if (deltas.length) changed.push({ old, new: neu, fields: deltas });
  }

  for (const old of oldPlayers) {
    if (!matchNew(old)) removed.push(old);
  }

  return { added, removed, changed };
}

function validateTeam(teamName, oldPlayers, newPlayers, diff) {
  const errors = [];
  if (!Array.isArray(newPlayers) || newPlayers.length < MIN_SQUAD_SIZE) {
    errors.push(`squad size ${newPlayers?.length ?? 0} is below minimum ${MIN_SQUAD_SIZE}`);
  }
  if (oldPlayers.length >= MIN_SQUAD_SIZE) {
    const ratio = diff.removed.length / oldPlayers.length;
    if (ratio > MAX_REMOVAL_RATIO) {
      errors.push(`${diff.removed.length}/${oldPlayers.length} removals (${Math.round(ratio * 100)}%) exceeds ${Math.round(MAX_REMOVAL_RATIO * 100)}% safety limit`);
    }
  }
  const nameless = newPlayers.filter((p) => !p.name).length;
  if (nameless) errors.push(`${nameless} player records are missing names`);
  return errors;
}

function printDiff(teamName, teamId, oldPlayers, newPlayers, diff, errors) {
  const icon = errors.length ? '!' : (diff.added.length || diff.removed.length || diff.changed.length ? '~' : '=');
  console.log(`\n${icon} ${teamName} [FotMob ${teamId}]  ${oldPlayers.length} → ${newPlayers.length}`);
  if (errors.length) errors.forEach((e) => console.log(`  BLOCKED: ${e}`));
  diff.added.forEach((p) => console.log(`  + ${p.name}${p.number != null ? ` (#${p.number})` : ''} [${p.position}]`));
  diff.removed.forEach((p) => console.log(`  - ${p.name}${p.number != null ? ` (#${p.number})` : ''}`));
  diff.changed.forEach(({ old, new: neu, fields }) => {
    const details = fields.map((f) => `${f}: ${old[f] ?? '—'} -> ${neu[f] ?? '—'}`).join('; ');
    console.log(`  ~ ${neu.name}: ${details}`);
  });
  if (!errors.length && !diff.added.length && !diff.removed.length && !diff.changed.length) console.log('  No changes');
}

async function updateCompetition(key, globalConfig, overrides, competitions) {
  const cfg = globalConfig.competitions[key];
  if (!cfg) throw new Error(`No FotMob updater config for competition "${key}"`);
  const competition = competitions[key];
  if (!competition?.files?.squads) throw new Error(`Competition "${key}" has no squad file configured`);

  const squadPath = path.join(ROOT, competition.files.squads);
  const current = readJson(squadPath);
  const next = { ...current };
  const teamEntries = Object.entries(cfg.teams).filter(([name]) => !ONLY_TEAM || sameName(name, ONLY_TEAM));
  if (!teamEntries.length) throw new Error(`No team matched --team "${ONLY_TEAM}"`);

  console.log(`${competition.label.toUpperCase()} — FotMob squad refresh`);
  console.log(WRITE ? 'WRITE MODE' : 'DRY RUN — no files will be modified');

  let totals = { added: 0, removed: 0, changed: 0, blocked: 0, checked: 0 };
  let configChanged = false;

  for (const [teamName, teamConfig] of teamEntries) {
    totals.checked++;
    try {
      const teamId = await resolveTeamId(teamName, teamConfig, globalConfig);
      if (!teamConfig.fotmobId) {
        teamConfig.fotmobId = teamId;
        configChanged = true;
      }
      const url = `${globalConfig.baseUrl}/teams?id=${teamId}&ccode3=${encodeURIComponent(cfg.countryCode || '')}`;
      if (VERBOSE) console.log(`Fetching ${url}`);
      const payload = await fotmobFetch(url);
      const oldPlayers = current[teamName] || [];
      const playerOverrides = overrides?.[key]?.players || {};
      const normalizedPlayers = normalizeSquad(payload, oldPlayers, globalConfig.imageBaseUrl, playerOverrides);
      const newPlayers = await enrichSquad(normalizedPlayers, globalConfig, teamName);
      const diff = diffSquads(oldPlayers, newPlayers);
      const errors = validateTeam(teamName, oldPlayers, newPlayers, diff);
      printDiff(teamName, teamId, oldPlayers, newPlayers, diff, errors);

      totals.added += diff.added.length;
      totals.removed += diff.removed.length;
      totals.changed += diff.changed.length;
      if (errors.length) {
        totals.blocked++;
      } else if (WRITE) {
        next[teamName] = newPlayers;
      }
    } catch (error) {
      totals.blocked++;
      console.log(`\n! ${teamName}`);
      console.log(`  BLOCKED: ${error.message}`);
    }
  }

  console.log('\n----------------------------------------');
  console.log(`${totals.checked} teams checked`);
  console.log(`${totals.added} additions, ${totals.removed} removals, ${totals.changed} changed players`);
  console.log(`${totals.blocked} teams blocked by errors/safety checks`);

  if (WRITE) {
    if (totals.blocked) {
      console.log(`\nSafe write: valid teams were updated; ${totals.blocked} blocked team(s) kept their existing squad.`);
    }
    writeJson(squadPath, next);
    if (configChanged) writeJson(CONFIG_PATH, globalConfig);
    console.log(`Wrote ${path.relative(ROOT, squadPath)}`);
  } else {
    console.log('\nDRY RUN complete. Re-run with --write to apply safe changes.');
    if (configChanged) console.log('Newly resolved team IDs will be saved to tools/fotmob-squads.json when run with --write.');
  }
}

async function main() {
  if (typeof fetch !== 'function') {
    throw new Error('This updater requires Node.js 18+ (native fetch).');
  }
  const config = readJson(CONFIG_PATH);
  const overrides = fs.existsSync(OVERRIDES_PATH) ? readJson(OVERRIDES_PATH) : {};
  const competitions = readJson(COMPETITIONS_PATH);
  await updateCompetition(target, config, overrides, competitions);
}

main().catch((error) => {
  console.error(`\nSquad updater failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
