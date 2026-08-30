#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_CONFIG_PATH = path.join(__dirname, 'fotmob-fixtures.json');
const TEAM_CONFIG_PATH = path.join(__dirname, 'fotmob-squads.json');
const COMPETITIONS_PATH = path.join(ROOT, 'data', 'competitions.json');
const TEAM_IDENTITIES_PATH = path.join(ROOT, 'data', 'team-identities.json');
const TEAM_STADIUMS_PATH = path.join(ROOT, 'data', 'team-stadiums.json');

const args = process.argv.slice(2);
const target = args.find((arg) => !arg.startsWith('--')) || 'epl';
const WRITE = args.includes('--write');
const VERBOSE = args.includes('--verbose');
const MIN_REMOTE_RATIO = Number(getArgValue('--min-remote-ratio') || 0.8);

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

function pick(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return null;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseRound(match) {
  const direct = pick(match, ['round', 'roundNumber', 'matchday', 'gameweek', 'roundId']);
  if (Number.isFinite(Number(direct))) return Number(direct);

  const text = String(pick(match, ['roundName', 'roundLabel', 'stageName']) || direct || '');
  const found = text.match(/\b(\d{1,3})\b/);
  return found ? Number(found[1]) : null;
}

function formatUtc(raw) {
  if (raw === null || raw === undefined || raw === '') return null;

  if (typeof raw === 'number' || /^\d{10,13}$/.test(String(raw))) {
    let n = Number(raw);
    if (n < 1e12) n *= 1000;
    const d = new Date(n);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().replace('.000Z', 'Z');
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().replace('.000Z', 'Z');
}

function getUtcTime(match) {
  const status = match?.status || {};
  return formatUtc(
    pick(status, ['utcTime', 'startTime', 'kickoff', 'dateUtc']) ||
    pick(match, ['utcTime', 'dateUtc', 'startTime', 'kickoff', 'timeTS', 'timestamp'])
  );
}

function getTeamObject(match, side) {
  const value = match?.[side] || match?.[`${side}Team`] || match?.teams?.[side];
  if (!value) return null;
  return typeof value === 'string' ? { name: value } : value;
}

function statusText(status) {
  const reason = status?.reason;
  return normalizeText([
    status?.status,
    status?.state,
    status?.short,
    status?.long,
    typeof reason === 'string' ? reason : reason?.short,
    typeof reason === 'object' ? reason?.long : null
  ].filter(Boolean).join(' '));
}

function fixtureStatus(match) {
  const status = match?.status || {};
  const text = statusText(status);

  if (status.cancelled === true || /cancel/.test(text)) return 'cancelled';
  if (status.postponed === true || /postpon/.test(text)) return 'postponed';
  if (status.finished === true || /full time|finished|after extra time|after penalties|\bft\b/.test(text)) return 'finished';
  if (status.started === true || status.live === true || /live|in progress|half time|\bht\b/.test(text)) return 'live';
  return 'scheduled';
}

function normalizeScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const match = text.match(/(\d+)\s*[-–—:]\s*(\d+)/);
  return match ? `${match[1]}-${match[2]}` : null;
}

function fixtureResult(match, statusName) {
  const status = match?.status || {};
  const scoreText = normalizeScore(pick(status, ['scoreStr', 'score', 'result']) || pick(match, ['scoreStr', 'result']));
  if (scoreText) return scoreText;

  if (statusName === 'finished' || statusName === 'live') {
    const home = getTeamObject(match, 'home');
    const away = getTeamObject(match, 'away');
    const hs = parseNumber(pick(home, ['score', 'goals']));
    const as = parseNumber(pick(away, ['score', 'goals']));
    if (hs !== null && as !== null) return `${hs}-${as}`;
  }
  return null;
}

function fixtureVenue(match) {
  const raw = pick(match, ['venue', 'stadium', 'ground']);
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  return pick(raw, ['name', 'fullName', 'title']) || null;
}

function looksLikeMatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const home = getTeamObject(value, 'home');
  const away = getTeamObject(value, 'away');
  return Boolean(home && away && (pick(home, ['name', 'teamName']) || home.id) && (pick(away, ['name', 'teamName']) || away.id));
}

function extractMatches(payload) {
  const directCandidates = [
    payload?.matches?.allMatches,
    payload?.content?.matches?.allMatches,
    payload?.data?.matches?.allMatches,
    payload?.fixtures?.allMatches,
    payload?.matches
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate) && candidate.filter(looksLikeMatch).length >= 2) {
      return candidate.filter(looksLikeMatch);
    }
  }

  const candidates = [];
  const seen = new Set();
  function walk(node, pathName = 'root') {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      const matches = node.filter(looksLikeMatch);
      if (matches.length >= 2) candidates.push({ pathName, matches });
      node.forEach((item, i) => walk(item, `${pathName}[${i}]`));
      return;
    }
    for (const [key, value] of Object.entries(node)) walk(value, `${pathName}.${key}`);
  }
  walk(payload);

  if (!candidates.length) return [];
  candidates.sort((a, b) => b.matches.length - a.matches.length);
  if (VERBOSE) console.log(`Fixture array discovered at ${candidates[0].pathName}`);
  return candidates[0].matches;
}

function buildTeamMaps(teamConfig, identities, allowedTeams) {
  const byId = new Map();
  const byName = new Map();
  const allowed = new Set(allowedTeams || []);

  function register(repoName, name) {
    if (!repoName || !name) return;
    byName.set(normalizeText(name), repoName);
  }

  for (const [repoName, cfg] of Object.entries(teamConfig?.teams || {})) {
    allowed.add(repoName);
    if (cfg?.fotmobId) byId.set(Number(cfg.fotmobId), repoName);
    register(repoName, repoName);
    register(repoName, cfg?.search);
  }

  // Central aliases shared by the UI and updater. Only register identities that
  // belong to this competition, which avoids cross-league name collisions.
  for (const repoName of allowed) {
    register(repoName, repoName);
    const identity = identities?.[repoName];
    for (const alias of identity?.aliases || []) register(repoName, alias);
  }

  return { byId, byName };
}

function repoTeamName(team, maps) {
  if (!team) return null;
  const id = parseNumber(pick(team, ['id', 'teamId']));
  if (id !== null && maps.byId.has(id)) return maps.byId.get(id);

  const rawName = pick(team, ['name', 'teamName', 'fullName']);
  if (!rawName) return null;
  const exact = maps.byName.get(normalizeText(rawName));
  if (exact) return exact;

  const wanted = normalizeText(rawName);
  for (const [alias, repoName] of maps.byName.entries()) {
    if (alias && (alias.includes(wanted) || wanted.includes(alias))) return repoName;
  }
  return null;
}

function normalizeRemoteFixture(match, maps) {
  const homeObj = getTeamObject(match, 'home');
  const awayObj = getTeamObject(match, 'away');
  const home = repoTeamName(homeObj, maps);
  const away = repoTeamName(awayObj, maps);
  const status = fixtureStatus(match);
  const dateUtc = getUtcTime(match);

  return {
    fotmobId: parseNumber(pick(match, ['id', 'matchId'])),
    round: parseRound(match),
    dateUtc,
    venue: fixtureVenue(match),
    home,
    away,
    result: fixtureResult(match, status),
    status,
    _remoteHome: pick(homeObj, ['name', 'teamName', 'fullName']) || null,
    _remoteAway: pick(awayObj, ['name', 'teamName', 'fullName']) || null
  };
}

function inferVenueMap(fixtures) {
  const counts = new Map();
  for (const fixture of fixtures) {
    if (!fixture.home || !fixture.venue) continue;
    if (!counts.has(fixture.home)) counts.set(fixture.home, new Map());
    const teamCounts = counts.get(fixture.home);
    teamCounts.set(fixture.venue, (teamCounts.get(fixture.venue) || 0) + 1);
  }
  const out = new Map();
  for (const [team, teamCounts] of counts) {
    const ranked = [...teamCounts.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked[0]) out.set(team, ranked[0][0]);
  }
  return out;
}

function stadiumName(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  return pick(value, ['stadium', 'venue', 'name', 'fullName', 'title']) || null;
}

function loadStadiums() {
  if (!fs.existsSync(TEAM_STADIUMS_PATH)) return {};
  const raw = readJson(TEAM_STADIUMS_PATH);
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function stadiumMapFromDatabase(database) {
  const map = new Map();
  for (const [team, value] of Object.entries(database || {})) {
    const stadium = stadiumName(value);
    if (stadium) map.set(team, stadium);
  }
  return map;
}

function learnVenueMap(fixtures, targetMap) {
  const inferred = inferVenueMap(fixtures);
  for (const [team, venue] of inferred) {
    if (team && venue && !targetMap.has(team)) targetMap.set(team, venue);
  }
  return targetMap;
}

function updateStadiumDatabase(database, venueMap) {
  let changed = 0;
  for (const [team, venue] of venueMap) {
    if (!team || !venue) continue;
    const current = stadiumName(database[team]);
    if (!current) {
      database[team] = { stadium: venue };
      changed++;
    }
  }
  return changed;
}

function fixturePairKey(fixture) {
  return `${normalizeText(fixture.home)}|${normalizeText(fixture.away)}`;
}

function fixtureRoundKey(fixture) {
  return `${fixturePairKey(fixture)}|${fixture.round ?? ''}`;
}

function buildExistingLookup(fixtures) {
  const byId = new Map();
  const byPair = new Map();
  const byRound = new Map();
  for (const fixture of fixtures) {
    if (fixture.fotmobId) byId.set(Number(fixture.fotmobId), fixture);
    const pair = fixturePairKey(fixture);
    if (!byPair.has(pair)) byPair.set(pair, []);
    byPair.get(pair).push(fixture);
    byRound.set(fixtureRoundKey(fixture), fixture);
  }
  return { byId, byPair, byRound };
}

function findExistingFixture(remote, lookup) {
  if (remote.fotmobId && lookup.byId.has(remote.fotmobId)) return lookup.byId.get(remote.fotmobId);
  const roundMatch = lookup.byRound.get(fixtureRoundKey(remote));
  if (roundMatch) return roundMatch;
  const pairMatches = lookup.byPair.get(fixturePairKey(remote)) || [];
  return pairMatches.length === 1 ? pairMatches[0] : null;
}

function mergeFixture(oldFixture, remote, venueMap) {
  const next = { ...oldFixture };

  if (remote.fotmobId) next.fotmobId = remote.fotmobId;
  if (remote.round !== null) next.round = remote.round;
  if (remote.dateUtc) next.dateUtc = remote.dateUtc;
  if (remote.home) next.home = remote.home;
  if (remote.away) next.away = remote.away;

  const venue = remote.venue || oldFixture.venue || venueMap.get(remote.home) || null;
  if (venue) next.venue = venue;

  // Never erase a known result because a remote response is incomplete.
  if (remote.result) next.result = remote.result;
  else if (oldFixture.result !== undefined) next.result = oldFixture.result;
  else next.result = null;

  if (remote.status) next.status = remote.status;
  return next;
}

function createFixture(remote, venueMap) {
  return {
    fotmobId: remote.fotmobId || null,
    round: remote.round,
    dateUtc: remote.dateUtc,
    venue: remote.venue || venueMap.get(remote.home) || null,
    home: remote.home,
    away: remote.away,
    result: remote.result || null,
    status: remote.status || 'scheduled'
  };
}

function meaningfulDiff(oldFixture, nextFixture) {
  const fields = ['round', 'dateUtc', 'venue', 'home', 'away', 'result'];
  const changed = fields.filter((field) => (oldFixture[field] ?? null) !== (nextFixture[field] ?? null));

  // Adding the default "scheduled" metadata on the first FotMob linking pass
  // is useful, but not a meaningful fixture change worth printing 380 times.
  if ((oldFixture.status ?? null) !== (nextFixture.status ?? null)) {
    if (oldFixture.status !== undefined || nextFixture.status !== 'scheduled') changed.push('status');
  }
  return changed;
}

function metadataDiff(oldFixture, nextFixture) {
  return !oldFixture.fotmobId && Boolean(nextFixture.fotmobId);
}

function sortFixtures(fixtures) {
  return fixtures.sort((a, b) => {
    const ar = Number(a.round ?? 9999);
    const br = Number(b.round ?? 9999);
    if (ar !== br) return ar - br;
    const ad = a.dateUtc ? new Date(a.dateUtc).getTime() : Number.MAX_SAFE_INTEGER;
    const bd = b.dateUtc ? new Date(b.dateUtc).getTime() : Number.MAX_SAFE_INTEGER;
    if (ad !== bd) return ad - bd;
    return `${a.home}-${a.away}`.localeCompare(`${b.home}-${b.away}`);
  });
}

async function fotmobFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json,text/plain,*/*',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 FixtureUpdater/1.0'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const type = res.headers.get('content-type') || '';
    if (!type.includes('json')) {
      const text = await res.text();
      throw new Error(`Expected JSON, received ${type || 'unknown content type'} (${text.slice(0, 100)})`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function validateRemote(existing, remote, cfg) {
  const errors = [];
  const unknownTeams = remote.filter((m) => !m.home || !m.away);
  if (unknownTeams.length) {
    const examples = unknownTeams.slice(0, 5).map((m) => `${m._remoteHome || '?'} vs ${m._remoteAway || '?'}`).join(', ');
    errors.push(`${unknownTeams.length} remote fixture(s) contain unknown team names: ${examples}`);
  }

  const ids = remote.map((m) => m.fotmobId).filter(Boolean);
  const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicateIds.length) errors.push(`${new Set(duplicateIds).size} duplicate FotMob match ID(s) detected`);

  const pairRounds = remote.filter((m) => m.home && m.away).map(fixtureRoundKey);
  const duplicatePairs = pairRounds.filter((key, i) => pairRounds.indexOf(key) !== i);
  if (duplicatePairs.length) errors.push(`${new Set(duplicatePairs).size} duplicate home/away/round fixture(s) detected`);

  if (existing.length >= 20 && remote.length < existing.length * MIN_REMOTE_RATIO) {
    errors.push(`FotMob returned only ${remote.length} fixtures versus ${existing.length} existing (${Math.round(remote.length / existing.length * 100)}%)`);
  }

  if (cfg.expectedMatches && remote.length < Math.floor(cfg.expectedMatches * 0.9)) {
    errors.push(`FotMob returned ${remote.length} fixtures; expected roughly ${cfg.expectedMatches}`);
  }
  if (cfg.minMatches && remote.length < cfg.minMatches) {
    errors.push(`FotMob returned ${remote.length} fixtures; expected at least ${cfg.minMatches}`);
  }
  return errors;
}

function display(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

async function updateCompetition(key, shared = null) {
  const fixtureConfig = shared?.fixtureConfig || readJson(FIXTURE_CONFIG_PATH);
  const squadConfig = shared?.squadConfig || readJson(TEAM_CONFIG_PATH);
  const competitions = shared?.competitions || readJson(COMPETITIONS_PATH);
  const cfg = fixtureConfig.competitions[key];
  const teamCfg = squadConfig.competitions[key];
  const competition = competitions[key];

  const summary = {
    key,
    label: competition?.label || key,
    status: 'failed',
    existing: 0,
    remote: 0,
    matched: 0,
    additions: 0,
    localOnly: 0,
    changes: 0,
    kickoffUpdates: 0,
    resultUpdates: 0,
    metadataLinked: 0,
    stadiumsLearned: 0,
    filteredOut: 0,
    written: false,
    message: null
  };

  try {
    if (!cfg) throw new Error(`No FotMob fixture config for competition "${key}"`);
    if (!teamCfg) throw new Error(`No FotMob team mapping for competition "${key}" in tools/fotmob-squads.json`);
    if (!competition?.files?.fixtures) throw new Error(`Competition "${key}" has no fixture file configured`);

    const fixturePath = path.join(ROOT, competition.files.fixtures);
    const existing = fs.existsSync(fixturePath) ? readJson(fixturePath) : [];
    if (!Array.isArray(existing)) throw new Error(`${competition.files.fixtures} must contain a JSON array`);
    summary.existing = existing.length;

    const identities = shared?.identities || readJson(TEAM_IDENTITIES_PATH);
    const allowedTeams = new Set(Object.keys(teamCfg?.teams || {}));
    for (const name of competition?.teamList || []) allowedTeams.add(name);
    for (const fixture of existing) {
      if (fixture.home) allowedTeams.add(fixture.home);
      if (fixture.away) allowedTeams.add(fixture.away);
    }
    const maps = buildTeamMaps(teamCfg, identities, [...allowedTeams]);
    const season = cfg.season ? `&season=${encodeURIComponent(cfg.season)}` : '';
    const ccode = cfg.countryCode ? `&ccode3=${encodeURIComponent(cfg.countryCode)}` : '';
    const url = `${fixtureConfig.baseUrl}/leagues?id=${cfg.leagueId}${ccode}${season}`;

    console.log(`${competition.label.toUpperCase()} — FotMob fixture refresh`);
    console.log(WRITE ? 'WRITE MODE' : 'DRY RUN — no files will be modified');
    if (VERBOSE) console.log(`Fetching ${url}`);

    const payload = await fotmobFetch(url);
    const rawMatches = extractMatches(payload);
    if (!rawMatches.length) throw new Error('Could not find a fixture list in FotMob league response');

    let remote = rawMatches.map((m) => normalizeRemoteFixture(m, maps));

    // Some cup/continental league feeds include qualifying or earlier-round
    // matches involving clubs outside the stage tracked by this repo. For
    // stage-scoped competitions (e.g. UCL league phase onward, EFL Cup R3
    // onward), ignore those out-of-scope matches rather than treating them as
    // unknown-team failures. Matches between configured teams remain eligible
    // and future knockout rounds are picked up automatically.
    let filteredOut = 0;
    if (cfg.filterToConfiguredTeams) {
      const before = remote.length;
      remote = remote.filter((m) => m.home && m.away);
      filteredOut = before - remote.length;
      if (VERBOSE && filteredOut) console.log(`Filtered ${filteredOut} out-of-scope FotMob fixture(s)`);
    }

    summary.remote = remote.length;
    const validationErrors = validateRemote(existing, remote, cfg);
    if (validationErrors.length) {
      summary.status = 'blocked';
      summary.message = validationErrors.join('; ');
      console.log('\nBLOCKED — fixture file will not be written');
      validationErrors.forEach((error) => console.log(`  - ${error}`));
      console.log(`\nExisting fixtures: ${existing.length}`);
      console.log(`FotMob fixtures:   ${remote.length}`);
      return summary;
    }

    // Stadium fallback order: FotMob fixture venue -> existing fixture venue ->
    // persistent home-stadium database. We also learn home grounds from any
    // venue-bearing fixtures in both the local and current remote schedule.
    const stadiumDatabase = shared?.stadiums || loadStadiums();
    const venueMap = stadiumMapFromDatabase(stadiumDatabase);
    learnVenueMap(existing, venueMap);
    learnVenueMap(remote, venueMap);
    const stadiumsLearned = updateStadiumDatabase(stadiumDatabase, venueMap);

    const lookup = buildExistingLookup(existing);
    const matchedExisting = new Set();
    const next = [];
    const changes = [];
    const additions = [];
    let metadataLinked = 0;
    let resultUpdates = 0;
    let kickoffUpdates = 0;

    for (const remoteFixture of remote) {
      const oldFixture = findExistingFixture(remoteFixture, lookup);
      if (!oldFixture) {
        const created = createFixture(remoteFixture, venueMap);
        additions.push(created);
        next.push(created);
        continue;
      }

      matchedExisting.add(oldFixture);
      const merged = mergeFixture(oldFixture, remoteFixture, venueMap);
      const fields = meaningfulDiff(oldFixture, merged);
      if (metadataDiff(oldFixture, merged)) metadataLinked++;
      if (fields.includes('result')) resultUpdates++;
      if (fields.includes('dateUtc')) kickoffUpdates++;
      if (fields.length) changes.push({ old: oldFixture, next: merged, fields });
      next.push(merged);
    }

    // FotMob omissions never delete local fixtures. Keep them and report them.
    const unmatchedExisting = existing.filter((fixture) => !matchedExisting.has(fixture));
    next.push(...unmatchedExisting);
    sortFixtures(next);

    Object.assign(summary, {
      status: 'safe',
      matched: matchedExisting.size,
      additions: additions.length,
      localOnly: unmatchedExisting.length,
      changes: changes.length,
      kickoffUpdates,
      resultUpdates,
      metadataLinked,
      stadiumsLearned,
      filteredOut
    });

    console.log(`\nExisting fixtures: ${existing.length}`);
    console.log(`FotMob fixtures:   ${remote.length}${filteredOut ? ` (${filteredOut} out-of-scope filtered)` : ''}`);
    console.log(`Matched:            ${matchedExisting.size}`);
    console.log(`New fixtures:       ${additions.length}`);
    console.log(`Local-only kept:    ${unmatchedExisting.length}`);
    console.log(`Meaningful changes: ${changes.length}`);
    console.log(`Kickoff updates:    ${kickoffUpdates}`);
    console.log(`Result updates:     ${resultUpdates}`);
    console.log(`FotMob IDs linked:  ${metadataLinked}`);
    console.log(`Stadiums learned:   ${stadiumsLearned}`);

    const MAX_PRINT = VERBOSE ? Number.MAX_SAFE_INTEGER : (target === 'all' ? 12 : 50);
    if (changes.length) {
      console.log('\nChanges:');
      changes.slice(0, MAX_PRINT).forEach(({ old, next: neu, fields }) => {
        const details = fields.map((field) => `${field}: ${display(old[field])} -> ${display(neu[field])}`).join('; ');
        console.log(`  ~ R${display(neu.round)} ${neu.home} vs ${neu.away}: ${details}`);
      });
      if (changes.length > MAX_PRINT) console.log(`  ... ${changes.length - MAX_PRINT} more (run with --verbose to show all)`);
    }

    if (additions.length) {
      console.log('\nAdditions:');
      additions.slice(0, MAX_PRINT).forEach((m) => console.log(`  + R${display(m.round)} ${m.home} vs ${m.away} — ${display(m.dateUtc)}`));
      if (additions.length > MAX_PRINT) console.log(`  ... ${additions.length - MAX_PRINT} more`);
    }

    if (unmatchedExisting.length) {
      console.log('\nLocal fixtures not returned by FotMob (preserved):');
      unmatchedExisting.slice(0, Math.min(MAX_PRINT, 20)).forEach((m) => console.log(`  = R${display(m.round)} ${m.home} vs ${m.away}`));
      if (unmatchedExisting.length > Math.min(MAX_PRINT, 20)) console.log(`  ... ${unmatchedExisting.length - Math.min(MAX_PRINT, 20)} more`);
    }

    if (WRITE) {
      fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
      writeJson(fixturePath, next);
      if (stadiumsLearned > 0) writeJson(TEAM_STADIUMS_PATH, stadiumDatabase);
      summary.written = true;
      console.log(`\nWrote ${path.relative(ROOT, fixturePath)}`);
    } else {
      console.log('\nDRY RUN complete. Re-run with --write to apply these safe changes.');
    }
    return summary;
  } catch (error) {
    summary.status = 'failed';
    summary.message = error.message;
    console.log(`\nFAILED — ${summary.label} was not written`);
    console.log(`  - ${error.message}`);
    return summary;
  }
}

function printAllSummary(results) {
  const safe = results.filter((r) => r.status === 'safe');
  const blocked = results.filter((r) => r.status === 'blocked');
  const failed = results.filter((r) => r.status === 'failed');
  const written = results.filter((r) => r.written);
  const totals = results.reduce((acc, r) => {
    acc.additions += r.additions || 0;
    acc.changes += r.changes || 0;
    acc.kickoffUpdates += r.kickoffUpdates || 0;
    acc.resultUpdates += r.resultUpdates || 0;
    acc.metadataLinked += r.metadataLinked || 0;
    acc.localOnly += r.localOnly || 0;
    acc.stadiumsLearned += r.stadiumsLearned || 0;
    return acc;
  }, { additions: 0, changes: 0, kickoffUpdates: 0, resultUpdates: 0, metadataLinked: 0, localOnly: 0, stadiumsLearned: 0 });

  console.log('\n' + '='.repeat(64));
  console.log(`ALL FIXTURES — ${WRITE ? 'WRITE' : 'DRY RUN'} SUMMARY`);
  console.log('='.repeat(64));
  for (const r of results) {
    const mark = r.status === 'safe' ? '✓' : r.status === 'blocked' ? '!' : '✗';
    const action = r.written ? 'written' : r.status === 'safe' ? (WRITE ? 'safe' : 'preview') : r.status;
    console.log(`${mark} ${r.label.padEnd(24)} ${String(r.existing).padStart(4)} → ${String(r.remote).padEnd(4)}  ${action}`);
    if (r.status !== 'safe' && r.message) console.log(`    ${r.message}`);
  }
  console.log('-'.repeat(64));
  console.log(`${results.length} competitions checked`);
  if (WRITE) console.log(`${written.length} written, ${blocked.length} blocked, ${failed.length} failed`);
  else console.log(`${safe.length} safe, ${blocked.length} blocked, ${failed.length} failed`);
  console.log(`${totals.additions} new fixtures`);
  console.log(`${totals.changes} meaningful fixture changes`);
  console.log(`${totals.kickoffUpdates} kickoff updates`);
  console.log(`${totals.resultUpdates} result updates`);
  console.log(`${totals.metadataLinked} FotMob IDs linked`);
  console.log(`${totals.stadiumsLearned} stadium mappings learned`);
  console.log(`${totals.localOnly} local-only fixtures preserved`);
  console.log('0 fixtures automatically deleted');
}

async function main() {
  if (typeof fetch !== 'function') throw new Error('This updater requires Node.js 18+ (native fetch).');

  if (target !== 'all') {
    const result = await updateCompetition(target);
    if (result.status !== 'safe') process.exitCode = 1;
    return;
  }

  const shared = {
    fixtureConfig: readJson(FIXTURE_CONFIG_PATH),
    squadConfig: readJson(TEAM_CONFIG_PATH),
    competitions: readJson(COMPETITIONS_PATH),
    identities: readJson(TEAM_IDENTITIES_PATH),
      stadiums: loadStadiums()
  };
  const keys = Object.keys(shared.fixtureConfig.competitions);
  const results = [];

  console.log(`ALL LEAGUES — FotMob fixture refresh (${keys.length} competitions)`);
  console.log(WRITE ? 'WRITE MODE — safe leagues will be written independently' : 'DRY RUN — no files will be modified');
  console.log('='.repeat(64));

  for (let i = 0; i < keys.length; i++) {
    if (i) console.log('\n' + '-'.repeat(64) + '\n');
    results.push(await updateCompetition(keys[i], shared));
  }

  printAllSummary(results);
  if (results.some((r) => r.status !== 'safe')) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\nFixture updater failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
