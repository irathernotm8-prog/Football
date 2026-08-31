#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HOF_PATH = path.join(ROOT, 'data', 'hall-of-fame.json');
const BASE = 'https://www.fotmob.com/api/data';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const VERBOSE = args.includes('--verbose');
const ONLY_PLAYER = getArgValue('--player');
const LIMIT = Number(getArgValue('--limit') || 0);
const DELAY_MS = Number(getArgValue('--delay') || 350);

function getArgValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function pick(obj, keys) {
  for (const key of keys) if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  return null;
}
async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 FootballDashboard/1.0', accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error('FotMob returned non-JSON data'); }
}
function findAllObjects(node, maxDepth = 7) {
  const out = [], seen = new Set();
  function walk(v, depth) {
    if (!v || typeof v !== 'object' || depth > maxDepth || seen.has(v)) return;
    seen.add(v);
    if (!Array.isArray(v)) out.push(v);
    for (const child of (Array.isArray(v) ? v : Object.values(v))) walk(child, depth + 1);
  }
  walk(node, 0); return out;
}
function candidateFromObject(obj) {
  const type = normalizeText(pick(obj, ['type','entityType','searchType','kind']));
  const name = pick(obj, ['name','title','fullName','playerName']);
  const id = Number(pick(obj, ['id','playerId','entityId']));
  if (!name || !Number.isFinite(id)) return null;
  if (type && !type.includes('player')) return null;
  return { id, name: String(name), type, teamName: pick(obj, ['teamName','team','subtitle']) };
}
async function resolvePlayerId(name) {
  const url = `${BASE}/search/suggest?hits=20&lang=en&term=${encodeURIComponent(name)}`;
  const payload = await fetchJson(url);
  const candidates = [];
  const seen = new Set();
  for (const obj of findAllObjects(payload)) {
    const c = candidateFromObject(obj);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id); candidates.push(c);
  }
  const exact = candidates.filter((c) => normalizeText(c.name) === normalizeText(name));
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) throw new Error(`Ambiguous player search: ${exact.map((c)=>`${c.name} (${c.id})`).join(', ')}`);
  throw new Error(`No exact FotMob player result; top results: ${candidates.slice(0,5).map((c)=>`${c.name} (${c.id})`).join(', ') || 'none'}`);
}
function findFirstValueByKeys(node, keys, maxDepth = 7) {
  const wanted = new Set(keys.map((k)=>k.toLowerCase())), seen = new Set();
  function walk(v, depth) {
    if (!v || typeof v !== 'object' || depth > maxDepth || seen.has(v)) return null;
    seen.add(v);
    if (!Array.isArray(v)) {
      for (const [k, child] of Object.entries(v)) if (wanted.has(k.toLowerCase()) && child !== null && child !== undefined && child !== '') return child;
    }
    for (const child of (Array.isArray(v) ? v : Object.values(v))) { const x=walk(child, depth+1); if (x !== null) return x; }
    return null;
  }
  return walk(node,0);
}
function findAllValuesByKeys(node, keys, maxDepth = 8) {
  const wanted = new Set(keys.map((k)=>k.toLowerCase())), found=[], seen=new Set();
  function walk(v, depth) {
    if (!v || typeof v !== 'object' || depth > maxDepth || seen.has(v)) return;
    seen.add(v);
    if (!Array.isArray(v)) for (const [k, child] of Object.entries(v)) if (wanted.has(k.toLowerCase()) && child !== null && child !== undefined && child !== '') found.push({key:k,value:child,depth});
    for (const child of (Array.isArray(v) ? v : Object.values(v))) walk(child, depth+1);
  }
  walk(node,0); return found;
}
function normalizePosition(raw) {
  if (raw && typeof raw === 'object') raw = pick(raw, ['description','positionDescription','positionName','name','position','label','shortName','code']);
  const t = normalizeText(raw);
  const m = [
    [/(goalkeeper|keeper|^gk$)/,'GK'], [/(right wing back|right wingback|rwb)/,'RWB'], [/(left wing back|left wingback|lwb)/,'LWB'],
    [/(right back|rightback|^rb$)/,'RB'], [/(left back|leftback|^lb$)/,'LB'], [/(centre back|center back|centreback|centerback|^cb$)/,'CB'],
    [/(defensive midfield|holding midfield|^dm$)/,'DM'], [/(central midfield|centre midfield|^cm$)/,'CM'], [/(attacking midfield|number 10|^am$)/,'AM'],
    [/(right midfield|^rm$)/,'RM'], [/(left midfield|^lm$)/,'LM'], [/(right wing|right winger|^rw$)/,'RW'], [/(left wing|left winger|^lw$)/,'LW'],
    [/(second striker|centre forward|center forward|striker|^cf$|^st$)/,'ST'], [/^defender$/,'DEFENDER'], [/^midfielder$/,'MIDFIELDER'], [/^(forward|attacker)$/,'FORWARD']
  ];
  for (const [re, code] of m) if (re.test(t)) return code;
  return null;
}
function specificity(pos) { return pos && !['DEFENDER','MIDFIELDER','FORWARD'].includes(pos) ? 2 : pos ? 1 : 0; }
function positionFromPlayerData(payload) {
  let best=null, score=0, depth=Infinity;
  for (const c of findAllValuesByKeys(payload, ['positionDescription','positionName','primaryPosition','preferredPosition','specificPosition','position','role'])) {
    const p=normalizePosition(c.value), s=specificity(p);
    if (p && (s>score || (s===score && c.depth<depth))) { best=p; score=s; depth=c.depth; }
  }
  return best;
}
function nationalityFromPlayerData(payload) {
  const raw = findFirstValueByKeys(payload, ['nationality','country','countryName','birthCountry','citizenship']);
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') return pick(raw, ['name','countryName','shortName','code']);
  return null;
}
function changesFor(old, next) {
  const fields=['fotmobId','position','nationality','photo'];
  return fields.filter((f)=> (old?.[f] ?? null) !== (next?.[f] ?? null)).map((f)=>`${f}: ${old?.[f] ?? '—'} -> ${next?.[f] ?? '—'}`);
}

async function main() {
  const hof=readJson(HOF_PATH);
  let names=Object.keys(hof);
  if (ONLY_PLAYER) names=names.filter((n)=>normalizeText(n)===normalizeText(ONLY_PLAYER));
  if (ONLY_PLAYER && !names.length) throw new Error(`Hall of Fame does not contain "${ONLY_PLAYER}"`);
  if (LIMIT>0) names=names.slice(0,LIMIT);

  console.log(`HALL OF FAME — FotMob enrichment`);
  console.log(`${WRITE ? 'WRITE MODE' : 'DRY RUN — no files will be modified'}`);
  console.log(`Inductees selected: ${names.length}\n`);

  let changed=0, unchanged=0, failed=0, resolved=0;
  for (let i=0;i<names.length;i++) {
    const name=names[i], old=hof[name] || {};
    try {
      let id=Number(old.fotmobId) || null;
      if (!id) { id=await resolvePlayerId(name); resolved++; await sleep(DELAY_MS); }
      const payload=await fetchJson(`${BASE}/playerData?id=${id}&includeMarketValues=false`);
      const next={...old, fotmobId:id, position:positionFromPlayerData(payload)||old.position||null, nationality:nationalityFromPlayerData(payload)||old.nationality||null, photo:`https://images.fotmob.com/image_resources/playerimages/${id}.png`, status:'Retired'};
      const diffs=changesFor(old,next);
      if (diffs.length) {
        changed++; hof[name]=next;
        console.log(`~ ${name} [${id}]${VERBOSE ? `\n    ${diffs.join('; ')}` : ''}`);
        if (WRITE && changed % 25 === 0) writeJson(HOF_PATH,hof);
      } else { unchanged++; if (VERBOSE) console.log(`= ${name} [${id}] no changes`); }
      await sleep(DELAY_MS);
    } catch (err) { failed++; console.log(`! ${name}: ${err.message}`); }
  }
  if (WRITE && changed) writeJson(HOF_PATH,hof);
  console.log('\n----------------------------------------');
  console.log(`${names.length} inductees checked`);
  console.log(`${changed} changed, ${unchanged} already complete, ${failed} failed`);
  console.log(`${resolved} FotMob IDs newly resolved`);
  console.log(WRITE ? 'Hall of Fame data written.' : 'DRY RUN complete. Re-run with --write to apply successful enrichments.');
}

main().catch((err)=>{ console.error(`\nERROR: ${err.message}`); process.exitCode=1; });
