#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const HOF_PATH = path.join(ROOT, 'data', 'hall-of-fame.json');
const SOURCES_PATH = path.join(ROOT, 'data', 'hall-image-sources.json');
const OUT_DIR = path.join(ROOT, 'assets', 'hall-of-fame');
const FIFAROSTERS = 'https://www.fifarosters.com';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const FORCE = args.includes('--force');
const VERBOSE = args.includes('--verbose');
const ONLY_PLAYER = getArgValue('--player');
const ONLY_URL = getArgValue('--url');
const LIMIT = Number(getArgValue('--limit') || 0);
const DELAY_MS = Number(getArgValue('--delay') || 450);

function getArgValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
function readJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function normalizeText(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-');
}
function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function stripTags(value) { return decodeHtml(String(value || '').replace(/<[^>]*>/g, '')).trim(); }

async function fetchResponse(url, accept = '*/*') {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36 FootballDashboard/1.0',
      accept,
      'accept-language': 'en-US,en;q=0.9'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
}
async function fetchText(url) {
  const res = await fetchResponse(url, 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
  return { text: await res.text(), finalUrl: res.url };
}

function parseBingRss(xml) {
  const results = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const title = stripTags((block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
    const link = decodeHtml(stripTags((block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]));
    if (link) results.push({ title, url: link });
  }
  return results;
}
function fifaPageScore(item, playerName) {
  let score = 0;
  let u;
  try { u = new URL(item.url); } catch { return -999; }
  if (!/(^|\.)fifarosters\.com$/i.test(u.hostname)) return -999;
  if (!/^\/players?$/i.test(u.pathname)) return -999;
  const titleNorm = normalizeText(item.title);
  const nameNorm = normalizeText(playerName);
  if (titleNorm === nameNorm) score += 120;
  if (titleNorm.startsWith(nameNorm + ' ')) score += 100;
  else if (titleNorm.includes(nameNorm)) score += 60;
  if (/icon|legend/i.test(item.title)) score += 20;
  if (/champion|toty|futties|shapeshifter|thunderstruck|promo|winter|debut|greats of the game/i.test(item.title)) score -= 10;
  const player = u.searchParams.get('player');
  const futid = u.searchParams.get('futid');
  if (player && futid && player === futid) score += 35; // base Icon/Legend card tends to be the most consistent portrait.
  if (u.searchParams.get('v')) score += 5;
  return score;
}
async function discoverViaBingRss(playerName) {
  const q = `site:fifarosters.com/players "${playerName}" FifaRosters`;
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}`;
  const { text } = await fetchText(url);
  return parseBingRss(text)
    .map((r) => ({ ...r, score: fifaPageScore(r, playerName), via: 'bing-rss' }))
    .filter((r) => r.score > 0);
}

function decodeSearchRedirect(raw) {
  if (!raw) return null;
  let value = decodeHtml(raw);
  try {
    const u = new URL(value, 'https://www.bing.com');
    // Bing occasionally wraps the destination in query params.
    for (const key of ['url', 'u', 'r']) {
      const nested = u.searchParams.get(key);
      if (nested && /^https?:/i.test(decodeURIComponent(nested))) return decodeURIComponent(nested);
    }
    return u.href;
  } catch { return null; }
}

function parseSearchHtml(html, playerName, via) {
  const rows = [];
  const seen = new Set();
  const anchorRe = /<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(html))) {
    const url = decodeSearchRedirect(m[1]);
    if (!url || seen.has(url) || !/fifarosters\.com\/players(?:\?|$)/i.test(url)) continue;
    seen.add(url);
    const title = stripTags(m[2]);
    const row = { title, url, via };
    row.score = fifaPageScore(row, playerName);
    if (row.score > 0) rows.push(row);
  }
  return rows;
}

async function discoverViaBingHtml(playerName) {
  const q = `site:fifarosters.com/players "${playerName}" FifaRosters`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}&count=20`;
  const { text } = await fetchText(url);
  return parseSearchHtml(text, playerName, 'bing-html');
}

async function discoverViaDuckDuckGo(playerName) {
  const q = `site:fifarosters.com/players "${playerName}" FifaRosters`;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const { text } = await fetchText(url);
  // DDG result links are often redirect URLs containing uddg=.
  const rows = [];
  const seen = new Set();
  const anchorRe = /<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(text))) {
    let raw = decodeHtml(m[1]);
    try {
      const u = new URL(raw, 'https://html.duckduckgo.com');
      const uddg = u.searchParams.get('uddg');
      if (uddg) raw = decodeURIComponent(uddg);
    } catch {}
    if (!/^https?:/i.test(raw) || !/fifarosters\.com\/players(?:\?|$)/i.test(raw) || seen.has(raw)) continue;
    seen.add(raw);
    const row = { title: stripTags(m[2]), url: raw, via: 'duckduckgo' };
    row.score = fifaPageScore(row, playerName);
    if (row.score > 0) rows.push(row);
  }
  return rows;
}

async function discoverPlayerPages(playerName) {
  const all = [];
  const methods = [discoverViaBingRss, discoverViaBingHtml, discoverViaDuckDuckGo];
  for (const method of methods) {
    try {
      const rows = await method(playerName);
      all.push(...rows);
      if (rows.some((r) => r.score >= 100)) break;
    } catch (err) {
      if (VERBOSE) console.log(`    discovery ${method.name} failed: ${err.message}`);
    }
  }
  const byUrl = new Map();
  for (const row of all) {
    const prev = byUrl.get(row.url);
    if (!prev || row.score > prev.score) byUrl.set(row.url, row);
  }
  return [...byUrl.values()].sort((a, b) => b.score - a.score);
}

function parseMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeHtml(m[1]);
  }
  return null;
}
function parseH1(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? stripTags(m[1]) : null;
}
function attr(tag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i');
  const m = tag.match(re);
  return m ? decodeHtml(m[1]) : null;
}
function absoluteUrl(src, baseUrl) {
  if (!src || /^data:/i.test(src)) return null;
  try { return new URL(src, baseUrl).href; } catch { return null; }
}
function imageCandidateScore(c, playerName) {
  const hay = `${c.url} ${c.alt || ''} ${c.title || ''} ${c.className || ''} ${c.id || ''}`.toLowerCase();
  let score = 0;
  const n = normalizeText(playerName);
  if (normalizeText(c.alt).includes(n)) score += 80;
  if (normalizeText(c.title).includes(n)) score += 50;
  if (/player.?image|player.?pic|player.?photo|headshot|portrait|face/.test(hay)) score += 80;
  if (/\/players?\/|playerimages|player_faces|playerfaces|\/faces\//.test(hay)) score += 55;
  if (/\.png(?:\?|$)/.test(c.url)) score += 20;
  if (/\.webp(?:\?|$)/.test(c.url)) score += 15;
  if (/\.jpe?g(?:\?|$)/.test(c.url)) score += 10;
  if (/card|background|badge|logo|flag|nation|teamlogo|loader|sprite|favicon|social|banner|adserver/.test(hay)) score -= 120;
  if (/fifarosters/i.test(c.url)) score += 15;
  return score;
}
function imageCandidatesFromPage(html, pageUrl, playerName) {
  const out = [];
  const seen = new Set();
  function add(raw, meta = {}) {
    const url = absoluteUrl(raw, pageUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    const c = { url, ...meta };
    c.score = imageCandidateScore(c, playerName);
    out.push(c);
  }
  const og = parseMeta(html, 'og:image');
  if (og) add(og, { source: 'og:image' });
  const tw = parseMeta(html, 'twitter:image');
  if (tw) add(tw, { source: 'twitter:image' });
  const imgRe = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    add(attr(tag, 'src') || attr(tag, 'data-src') || attr(tag, 'data-lazy-src'), {
      source: 'img', alt: attr(tag, 'alt'), title: attr(tag, 'title'), className: attr(tag, 'class'), id: attr(tag, 'id')
    });
  }
  return out.sort((a, b) => b.score - a.score);
}
function parseFifaParams(pageUrl) {
  try {
    const u = new URL(pageUrl);
    return {
      playerId: u.searchParams.get('player') ? Number(u.searchParams.get('player')) : null,
      futId: u.searchParams.get('futid') ? Number(u.searchParams.get('futid')) : null,
      version: u.searchParams.get('v') ? Number(u.searchParams.get('v')) : null
    };
  } catch { return { playerId: null, futId: null, version: null }; }
}
async function resolvePage(playerName, sourceConfig) {
  if (ONLY_URL) return { url: ONLY_URL, discovered: false, candidates: [] };
  const configured = sourceConfig[playerName]?.url || sourceConfig[playerName];
  if (typeof configured === 'string' && configured.startsWith('http')) return { url: configured, discovered: false, candidates: [] };

  const candidates = await discoverPlayerPages(playerName);
  if (!candidates.length) throw new Error('No FifaRosters player page found');

  // Verify the best few pages actually identify the requested player.
  const verified = [];
  for (const c of candidates.slice(0, 5)) {
    try {
      const { text, finalUrl } = await fetchText(c.url);
      const h1 = parseH1(text);
      const title = stripTags((text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
      const pageName = h1 || title.split('|')[0].trim();
      const exact = normalizeText(pageName) === normalizeText(playerName);
      if (exact) verified.push({ ...c, url: finalUrl, html: text, pageName });
      await sleep(Math.min(DELAY_MS, 250));
    } catch {}
  }
  if (!verified.length) throw new Error(`Search found FifaRosters pages, but none verified as exact "${playerName}"`);
  verified.sort((a, b) => b.score - a.score);
  if (verified.length > 1 && verified[0].score === verified[1].score && verified[0].url !== verified[1].url) {
    throw new Error(`Ambiguous FifaRosters pages; pin one URL in data/hall-image-sources.json`);
  }
  return { url: verified[0].url, discovered: true, candidates, html: verified[0].html };
}

async function inspectPlayer(playerName, sourceConfig) {
  const page = await resolvePage(playerName, sourceConfig);
  let html = page.html;
  let finalUrl = page.url;
  if (!html) {
    const fetched = await fetchText(page.url);
    html = fetched.text; finalUrl = fetched.finalUrl;
  }
  const h1 = parseH1(html);
  if (h1 && normalizeText(h1) !== normalizeText(playerName)) {
    throw new Error(`FifaRosters page identifies "${h1}", not "${playerName}"`);
  }
  const images = imageCandidatesFromPage(html, finalUrl, playerName);
  if (!images.length || images[0].score < 20) {
    throw new Error(`No confident player image found on FifaRosters page${VERBOSE && images[0] ? `; best candidate ${images[0].url} score=${images[0].score}` : ''}`);
  }
  if (images.length > 1 && images[0].score === images[1].score && images[0].url !== images[1].url) {
    throw new Error('Multiple equally likely FifaRosters images; use --verbose and pin imageUrl in data/hall-image-sources.json');
  }
  const configured = sourceConfig[playerName];
  const pinnedImage = configured && typeof configured === 'object' ? configured.imageUrl : null;
  const selected = pinnedImage ? { url: pinnedImage, score: 999, source: 'override' } : images[0];
  return { pageUrl: finalUrl, image: selected, params: parseFifaParams(finalUrl), candidates: images.slice(0, 10) };
}

function extensionFrom(contentType, url) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('image/png')) return '.png';
  if (ct.includes('image/webp')) return '.webp';
  if (ct.includes('image/jpeg')) return '.jpg';
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (['.png','.webp','.jpg','.jpeg'].includes(ext)) return ext === '.jpeg' ? '.jpg' : ext;
  } catch {}
  return '.png';
}
async function downloadImage(url, playerName) {
  const res = await fetchResponse(url, 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8');
  const ct = res.headers.get('content-type') || '';
  if (!ct.toLowerCase().startsWith('image/')) throw new Error(`Image URL returned ${ct || 'non-image content'}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2500) throw new Error(`Downloaded image is suspiciously small (${buf.length} bytes)`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ext = extensionFrom(ct, res.url || url);
  const fileName = `${slugify(playerName)}${ext}`;
  const abs = path.join(OUT_DIR, fileName);
  fs.writeFileSync(abs, buf);
  return { abs, relative: `assets/hall-of-fame/${fileName}`, bytes: buf.length };
}

async function main() {
  const hof = readJson(HOF_PATH);
  const sources = readJson(SOURCES_PATH, {});
  let names = Object.keys(hof);
  if (ONLY_PLAYER) names = names.filter((n) => normalizeText(n) === normalizeText(ONLY_PLAYER));
  if (ONLY_PLAYER && !names.length) throw new Error(`Hall of Fame does not contain "${ONLY_PLAYER}"`);
  if (LIMIT > 0) names = names.slice(0, LIMIT);

  console.log('HALL OF FAME — FifaRosters portrait enrichment');
  console.log(WRITE ? 'WRITE MODE — local portraits will be downloaded' : 'DRY RUN — no files will be modified');
  console.log(`Inductees selected: ${names.length}\n`);

  let found = 0, written = 0, skipped = 0, failed = 0;
  for (const name of names) {
    const old = hof[name] || {};
    if (!FORCE && typeof old.photo === 'string' && old.photo.startsWith('assets/hall-of-fame/')) {
      skipped++; if (VERBOSE) console.log(`= ${name}: already has local Hall portrait`); continue;
    }
    try {
      const info = await inspectPlayer(name, sources);
      found++;
      console.log(`~ ${name}`);
      console.log(`    page:  ${info.pageUrl}`);
      console.log(`    image: ${info.image.url}${VERBOSE ? `  [score ${info.image.score}, ${info.image.source}]` : ''}`);
      if (VERBOSE && info.candidates.length > 1) {
        for (const c of info.candidates.slice(1, 5)) console.log(`      alt: ${c.url} [score ${c.score}]`);
      }
      if (WRITE) {
        const dl = await downloadImage(info.image.url, name);
        hof[name] = {
          ...old,
          photo: dl.relative,
          photoSource: 'fifarosters',
          fifaRostersUrl: info.pageUrl,
          fifaRostersPlayerId: info.params.playerId,
          fifaRostersFutId: info.params.futId,
          fifaVersion: info.params.version
        };
        written++;
        if (written % 20 === 0) writeJson(HOF_PATH, hof);
        console.log(`    saved: ${dl.relative}`);
      }
    } catch (err) {
      failed++;
      console.log(`! ${name}: ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  if (WRITE && written) writeJson(HOF_PATH, hof);
  console.log('\n----------------------------------------');
  console.log(`${names.length} inductees checked`);
  console.log(`${found} FifaRosters portraits resolved, ${skipped} already local, ${failed} unresolved`);
  if (WRITE) console.log(`${written} portraits downloaded into assets/hall-of-fame/`);
  else console.log('DRY RUN complete. Re-run with --write to download and apply successful portraits.');
  if (failed) console.log('Tip: ambiguous/missing players can be pinned in data/hall-image-sources.json with an exact FifaRosters URL.');
}

main().catch((err) => { console.error(`\nERROR: ${err.message}`); process.exitCode = 1; });
