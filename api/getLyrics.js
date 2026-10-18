// api/getLyrics.js — REPLACES base44/functions/getLyrics/entry.ts
// Deploy target: same as searchMusic.js (Vercel serverless / Railway+Express).
// Sources: LRCLIB (many lookups at once), NetEase (second synced source), lyrics.ovh (written only).
// No env vars needed; none of them require a key.

import { rateLimit } from './_guard.js';

function cleanTitle(title) {
  return (title || '')
    .replace(/\(.*?(official|video|audio|lyric|lyrics|visualizer|visualiser|hd|4k|mv|music video|remaster|explicit|clean|performance).*?\)/gi, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\bfeat\.|\bft\./gi, '')
    .replace(/official (music )?video/gi, '')
    .replace(/official audio/gi, '')
    .replace(/(lyric|lyrics)\s*(video)?/gi, '')
    .replace(/\baudio\b/gi, '')
    .replace(/\|.*$/, '')
    .replace(/"/g, '')
    .replace(/\s*-\s*topic\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanArtist(artist) {
  if (!artist) return '';
  return artist
    .replace(/\s*-\s*topic\s*$/i, '')
    .replace(/\s*vevo$/i, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\bofficial\b/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitArtistFromTitle(title) {
  if (!title) return null;
  const m = title.match(/^(.*?)\s*[-–—]\s*(.*)$/);
  if (m && m[1] && m[2]) return { artist: m[1].trim(), title: m[2].trim() };
  return null;
}

async function fetchWithTimeout(url, ms, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(id);
    return r;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

function parseSynced(synced) {
  if (!synced) return [];
  const lines = [];
  let offset = 0; // LRC [offset:+/-ms] tag (positive = lyrics appear earlier)
  for (const raw of synced.split(/\r?\n/)) {
    const off = raw.match(/^\[offset:\s*([+-]?\d+)\s*\]/i);
    if (off) { offset = parseInt(off[1], 10) / 1000; continue; }
    // A line can carry several timestamps: [00:10.00][00:50.00] text
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseInt((m[3] + '00').slice(0, 3), 10) / 1000 : 0;
      lines.push({ time: Math.max(0, min * 60 + sec + frac - offset), text });
    }
  }
  lines.sort((a, b) => a.time - b.time);
  return lines;
}

// All LRCLIB lookups run together and every result is collected, so we can pick the best
// SYNCED one instead of settling for the first (often written-only) hit.
async function lrclibGet(artist, title, duration, ms) {
  try {
    let url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
    if (duration > 0) url += `&duration=${Math.round(duration)}`;
    const r = await fetchWithTimeout(url, ms);
    if (!r.ok) return [];
    const d = await r.json();
    return d && (d.syncedLyrics || d.plainLyrics) ? [d] : [];
  } catch { return []; }
}

async function lrclibSearch(qs, ms) {
  try {
    const r = await fetchWithTimeout(`https://lrclib.net/api/search?${qs}`, ms);
    if (!r.ok) return [];
    const arr = await r.json();
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

async function gatherLrclib(artists, titles, duration, ms) {
  const jobs = [];
  for (const a of artists.slice(0, 2)) {
    for (const t of titles.slice(0, 2)) {
      jobs.push(lrclibGet(a, t, duration, ms));
      jobs.push(lrclibSearch(`track_name=${encodeURIComponent(t)}&artist_name=${encodeURIComponent(a)}`, ms));
      jobs.push(lrclibSearch(`q=${encodeURIComponent(`${a} ${t}`)}`, ms));
    }
  }
  for (const t of titles.slice(0, 2)) jobs.push(lrclibSearch(`q=${encodeURIComponent(t)}`, ms));
  const all = (await Promise.all(jobs)).flat();
  const seen = new Set();
  return all.filter((d) => {
    if (!d || !(d.syncedLyrics || d.plainLyrics)) return false;
    const k = d.id ?? `${d.trackName}|${d.artistName}|${d.duration}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const norm = (x) => (x || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff\u4e00-\u9fff]+/g, '');

// Candidates that don't look like the requested song are ignored (the search is fuzzy).
function looksRight(d, titles, artists) {
  const name = norm(d.trackName || d.name);
  const okTitle = !name || titles.some((t) => { const n = norm(t); return n && (name.includes(n) || n.includes(name)); });
  if (!okTitle) return false;
  const art = norm(d.artistName);
  if (!art || !artists.length) return true;
  return artists.some((a) => { const n = norm(a); return n && (art.includes(n) || n.includes(art)); });
}

const SYNC_TOLERANCE = 12; // seconds: further off than this is a different recording

function pickSynced(cands, duration) {
  const synced = cands.filter((d) => d.syncedLyrics);
  if (!synced.length) return null;
  if (!(duration > 0)) return synced[0];
  let best = null;
  let bestDiff = Infinity;
  for (const d of synced) {
    const diff = Math.abs((Number(d.duration) || 0) - duration);
    if (diff < bestDiff) { best = d; bestDiff = diff; }
  }
  return bestDiff <= SYNC_TOLERANCE ? best : null;
}

function pickPlain(cands, duration) {
  const withText = cands.filter((d) => d.plainLyrics);
  if (!withText.length) return '';
  if (!(duration > 0)) return withText[0].plainLyrics;
  withText.sort((a, b) => Math.abs((Number(a.duration) || 0) - duration) - Math.abs((Number(b.duration) || 0) - duration));
  return withText[0].plainLyrics;
}

// Second synced source (NetEase). No key needed. Used when LRCLIB has no synced match.
async function tryNetease(artist, titles, duration, ms) {
  try {
    const headers = { Referer: 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' };
    const q = `${artist} ${titles[0] || ''}`.trim();
    const r = await fetchWithTimeout(
      `https://music.163.com/api/search/get/web?csrf_token=&hlpretag=&hlposttag=&s=${encodeURIComponent(q)}&type=1&offset=0&total=true&limit=8`,
      ms, { headers }
    );
    if (!r.ok) return '';
    const data = await r.json().catch(() => null);
    const songs = data?.result?.songs;
    if (!Array.isArray(songs) || !songs.length) return '';
    const ranked = songs
      .map((x) => ({
        id: x.id,
        name: x.name,
        artistName: (x.artists || x.ar || []).map((a) => a.name).join(' '),
        duration: (Number(x.duration || x.dt) || 0) / 1000,
      }))
      .filter((x) => looksRight(x, titles, artist ? [artist] : []))
      .sort((a, b) => (duration > 0 ? Math.abs(a.duration - duration) - Math.abs(b.duration - duration) : 0));
    const top = ranked[0];
    if (!top) return '';
    if (duration > 0 && Math.abs(top.duration - duration) > SYNC_TOLERANCE) return '';
    const lr = await fetchWithTimeout(`https://music.163.com/api/song/lyric?id=${top.id}&lv=1&kv=1&tv=-1`, ms, { headers });
    if (!lr.ok) return '';
    const ld = await lr.json().catch(() => null);
    const lrc = ld?.lrc?.lyric || '';
    return /\[\d{1,3}:\d{2}/.test(lrc) ? lrc : '';
  } catch { return ''; }
}

async function tryOvh(artist, title, ms) {
  try {
    const r = await fetchWithTimeout(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, ms);
    if (!r.ok) return '';
    const d = await r.json();
    return (d && d.lyrics) || '';
  } catch { return ''; }
}

export default async function handler(req, res) {
  if (!rateLimit(req, res, { name: 'lyrics', max: 30, windowMs: 60 * 1000 })) return undefined;
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    let artist = (body.artist || '').toString().trim().slice(0, 200);
    let title = (body.title || '').toString().trim().slice(0, 200);
    const duration = Number(body.duration) > 0 ? Number(body.duration) : 0;
    if (!title) return res.status(200).json({ lines: [], plain: '' });

    artist = cleanArtist(artist);

    const cleanTitles = [];
    const titleArtists = [];
    const addTitle = (t) => { const c = cleanTitle(t); if (c && !cleanTitles.includes(c)) cleanTitles.push(c); };
    addTitle(title);
    const split = splitArtistFromTitle(title);
    if (split) { addTitle(split.title); if (!artist) titleArtists.push(cleanArtist(split.artist)); }

    const artists = Array.from(new Set([artist, ...titleArtists].filter(Boolean)));

    const STAGE_MS = 6000;

    // 1) LRCLIB (many lookups at once) and NetEase run in parallel
    const [cands, neteaseLrc] = await Promise.all([
      gatherLrclib(artists, cleanTitles, duration, STAGE_MS),
      tryNetease(artists[0] || '', cleanTitles, duration, STAGE_MS),
    ]);
    const good = cands.filter((d) => looksRight(d, cleanTitles, artists));
    const pool = good.length ? good : cands;

    let synced = '';
    let plain = '';
    const bestSynced = pickSynced(pool, duration);
    if (bestSynced) {
      synced = bestSynced.syncedLyrics;
      plain = bestSynced.plainLyrics || '';
    } else if (neteaseLrc) {
      synced = neteaseLrc;
    }
    if (!plain) plain = pickPlain(pool, duration);

    // 2) written lyrics as a last resort (the app will time them across the song)
    if (!synced && !plain) {
      const start = Date.now();
      for (const a of artists) {
        if (Date.now() - start >= 6000) break;
        for (const t of cleanTitles) {
          if (Date.now() - start >= 6000) break;
          const ovh = await tryOvh(a, t, 3000);
          if (ovh) { plain = ovh; break; }
        }
        if (plain) break;
      }
    }

    const lines = parseSynced(synced);
    return res.status(200).json({ lines, plain });
  } catch (error) {
    return res.status(200).json({ lines: [], plain: '' });
  }
}
