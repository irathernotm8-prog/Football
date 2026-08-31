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
  const hay = `${c.url} ${c.alt || ''} ${c.title || ''} ${c.className || ''} ${c.id || ''} ${c.context || ''}`.toLowerCase();
  let score = 0;
  const n = normalizeText(playerName);
  if (normalizeText(c.alt).includes(n)) score += 100;
  if (normalizeText(c.title).includes(n)) score += 60;
  if (/player.?image|player.?pic|player.?photo|headshot|portrait|face|playerimg|player-img/.test(hay)) score += 110;
  if (/\/players?\/|playerimages|player_faces|playerfaces|\/faces\/|\/heads?\//.test(hay)) score += 70;
  if (/dynamic.?image|cutout|render/.test(hay)) score += 45;
  if (/\.png(?:\?|$)/.test(c.url)) score += 25;
  if (/\.webp(?:\?|$)/.test(c.url)) score += 15;
  if (/\.jpe?g(?:\?|$)/.test(c.url)) score += 8;
  if (/card|background|badge|logo|flag|nation|teamlogo|loader|sprite|favicon|social|banner|adserver|pitch|chemstyle|position.?rating/.test(hay)) score -= 160;
  if (/fifarosters/i.test(c.url)) score += 10;
  if (Number(c.width) >= 150 && Number(c.height) >= 150) score += 10;
  if (Number(c.width) && Number(c.height) && Number(c.height) > Number(c.width)) score += 8;
  return score;
}
function imageCandidatesFromPage(html, pageUrl, playerName) {
  const out = [];
  const seen = new Set();
  const otherVersionsIndex = (() => {
    const probes = ['Other FUT', 'Generations', 'Player Info'];
    const hits = probes.map((p) => html.indexOf(p)).filter((n) => n >= 0);
    return hits.length ? Math.min(...hits) : html.length;
  })();
  function add(raw, meta = {}) {
    const url = absoluteUrl(raw, pageUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    const c = { url, ...meta };
    c.score = imageCandidateScore(c, playerName);
    if (Number.isFinite(c.pageIndex)) {
      if (c.pageIndex < otherVersionsIndex && /\/faces\//i.test(c.url)) c.score += 38;
      if (c.pageIndex > otherVersionsIndex) c.score -= 6;
    }
    out.push(c);
  }
  const og = parseMeta(html, 'og:image');
  if (og) add(og, { source: 'og:image', context: 'meta social image', pageIndex: -2 });
  const tw = parseMeta(html, 'twitter:image');
  if (tw) add(tw, { source: 'twitter:image', context: 'meta social image', pageIndex: -1 });
  const imgRe = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    const context = stripTags(html.slice(Math.max(0, m.index - 260), Math.min(html.length, m.index + tag.length + 260)));
    add(attr(tag, 'src') || attr(tag, 'data-src') || attr(tag, 'data-lazy-src'), {
      source: 'img', alt: attr(tag, 'alt'), title: attr(tag, 'title'), className: attr(tag, 'class'), id: attr(tag, 'id'),
      width: attr(tag, 'width'), height: attr(tag, 'height'), context, pageIndex: m.index
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

function parsePngInfo(buf) {
  if (!buf || buf.length < 33) return null;
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  if (!buf.subarray(0,8).equals(sig)) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  return { width, height, hasAlpha: colorType === 4 || colorType === 6, format: 'png' };
}
function parseJpegInfo(buf) {
  if (!buf || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    i += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (i + 2 > buf.length) break;
    const len = buf.readUInt16BE(i);
    if (len < 2 || i + len > buf.length) break;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && len >= 7) {
      return { width: buf.readUInt16BE(i + 5), height: buf.readUInt16BE(i + 3), hasAlpha: false, format: 'jpeg' };
    }
    i += len;
  }
  return null;
}
async function probeImageCandidate(c) {
  try {
    const res = await fetchResponse(c.url, 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8');
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.startsWith('image/')) return { ...c, probeScore: -500, probeError: `non-image ${ct}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const info = parsePngInfo(buf) || parseJpegInfo(buf) || {};
    let probeScore = 0;
    const width = Number(info.width || c.width || 0);
    const height = Number(info.height || c.height || 0);
    if (info.hasAlpha) probeScore += 70;
    if (info.format === 'png') probeScore += 15;
    if (width >= 180 && height >= 180) probeScore += 20;
    if (width >= 300 && height >= 300) probeScore += 15;
    if (width && height) {
      const ratio = width / height;
      if (ratio >= 0.45 && ratio <= 1.15) probeScore += 25; // portrait/cutout-like
      if (ratio > 1.45) probeScore -= 35; // banners and wide assets
      if (width <= 140 || height <= 140) probeScore -= 50; // flags, badges, icons
    }
    if (buf.length >= 15000) probeScore += 10;
    if (buf.length < 3000) probeScore -= 40;
    return { ...c, probeScore, totalScore: c.score + probeScore, probe: { ...info, bytes: buf.length, contentType: ct } };
  } catch (err) {
    return { ...c, probeScore: -250, totalScore: c.score - 250, probeError: err.message };
  }
}
async function chooseBestImage(images, playerName) {
  if (!images.length) return { selected: null, probed: [] };
  // Probe only plausible top candidates. This keeps requests low while breaking DOM-score ties.
  const cutoff = Math.max(20, images[0].score - 35);
  const shortlist = images.filter((c) => c.score >= cutoff).slice(0, 8);
  const probed = [];
  for (const c of shortlist) {
    probed.push(await probeImageCandidate(c));
    await sleep(Math.min(DELAY_MS, 180));
  }
  probed.sort((a,b) => {
    const scoreDiff = (b.totalScore ?? b.score) - (a.totalScore ?? a.score);
    if (scoreDiff) return scoreDiff;
    const aMain = /\/faces\//i.test(a.url) && a.probe?.hasAlpha && Number(a.probe?.width) >= 300 && Number(a.probe?.height) >= 300;
    const bMain = /\/faces\//i.test(b.url) && b.probe?.hasAlpha && Number(b.probe?.width) >= 300 && Number(b.probe?.height) >= 300;
    if (aMain !== bMain) return bMain - aMain;
    return (a.pageIndex ?? Number.MAX_SAFE_INTEGER) - (b.pageIndex ?? Number.MAX_SAFE_INTEGER);
  });
  const selected = probed[0] || images[0];
  if (!selected || (selected.totalScore ?? selected.score) < 35) return { selected: null, probed };
  return { selected, probed };
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
  const configured = sourceConfig[playerName];
  const isPinnedPage = configured && typeof configured === 'object' && configured.url;
  if (!isPinnedPage && h1 && normalizeText(h1) !== normalizeText(playerName)) {
    throw new Error(`FifaRosters page identifies "${h1}", not "${playerName}"`);
  }
  const images = imageCandidatesFromPage(html, finalUrl, playerName);
  if (!images.length || images[0].score < 20) {
    throw new Error(`No confident player image found on FifaRosters page${VERBOSE && images[0] ? `; best candidate ${images[0].url} score=${images[0].score}` : ''}`);
  }
  const pinnedImage = configured && typeof configured === 'object' ? configured.imageUrl : null;
  if (pinnedImage) {
    return { pageUrl: finalUrl, image: { url: pinnedImage, score: 999, totalScore: 999, source: 'override' }, params: parseFifaParams(finalUrl), candidates: images.slice(0, 10), probed: [] };
  }
  const chosen = await chooseBestImage(images, playerName);
  if (!chosen.selected) throw new Error('No confident player portrait after inspecting candidate image dimensions/transparency');
  if (chosen.probed.length > 1) {
    const a = chosen.probed[0], b = chosen.probed[1];
    const gap = (a.totalScore ?? a.score) - (b.totalScore ?? b.score);
    if (gap < 8 && a.url !== b.url) {
      const aCutout = /\/faces\//i.test(a.url) && a.probe?.hasAlpha && Number(a.probe?.width) >= 300 && Number(a.probe?.height) >= 300;
      const bCutout = /\/faces\//i.test(b.url) && b.probe?.hasAlpha && Number(b.probe?.width) >= 300 && Number(b.probe?.height) >= 300;
      // If both are legitimate player cutouts, DOM order is intentional: the main selected
      // version is rendered before the alternate-version/generation galleries.
      if (!(aCutout && bCutout && Number.isFinite(a.pageIndex) && Number.isFinite(b.pageIndex) && a.pageIndex !== b.pageIndex)) {
        throw new Error('Multiple FifaRosters images remain visually ambiguous after probing; pin imageUrl in data/hall-image-sources.json');
      }
    }
  }
  return { pageUrl: finalUrl, image: chosen.selected, params: parseFifaParams(finalUrl), candidates: images.slice(0, 10), probed: chosen.probed };
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
      if (VERBOSE && info.probed?.length) {
        for (const c of info.probed.slice(0, 6)) {
          const p = c.probe || {};
          console.log(`      probe: ${c.url} [dom ${c.score}, probe ${c.probeScore ?? 'n/a'}, total ${c.totalScore ?? c.score}, ${p.width || '?'}x${p.height || '?'}, alpha=${p.hasAlpha ?? '?'}, ${p.bytes || '?'} bytes]`);
        }
      } else if (VERBOSE && info.candidates.length > 1) {
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
