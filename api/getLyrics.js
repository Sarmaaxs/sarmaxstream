// api/getLyrics.js — REPLACES base44/functions/getLyrics/entry.ts
// Deploy target: same as searchMusic.js (Vercel serverless / Railway+Express).
// No Base44 coupling to remove here beyond the export signature — this file
// was already just proxying two free third-party lyrics APIs (LRCLIB,
// lyrics.ovh) and returning whatever they send back to your own frontend.
// No env vars needed; neither API requires a key.

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

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal });
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
  for (const raw of synced.split('\n')) {
    const m = raw.match(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\](.*)/);
    if (!m) continue;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    const frac = m[3] ? parseInt((m[3] + '00').slice(0, 3), 10) / 1000 : 0;
    lines.push({ time: min * 60 + sec + frac, text: (m[4] || '').trim() });
  }
  return lines;
}

async function tryLrclibGet(artist, title, ms) {
  try {
    const r = await fetchWithTimeout(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`, ms);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d) return null;
    return { synced: d.syncedLyrics || '', plain: d.plainLyrics || '' };
  } catch { return null; }
}

async function tryLrclibSearch(q, ms) {
  try {
    const r = await fetchWithTimeout(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, ms);
    if (!r.ok) return null;
    const arr = await r.json();
    if (!Array.isArray(arr) || !arr.length) return null;
    const best = arr.find((d) => d.syncedLyrics) || arr.find((d) => d.plainLyrics) || arr[0];
    return { synced: best?.syncedLyrics || '', plain: best?.plainLyrics || '' };
  } catch { return null; }
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
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    let artist = (body.artist || '').toString().trim();
    let title = (body.title || '').toString().trim();
    if (!title) return res.status(200).json({ lines: [], plain: '' });

    artist = cleanArtist(artist);

    const cleanTitles = [];
    const titleArtists = [];
    const addTitle = (t) => { const c = cleanTitle(t); if (c && !cleanTitles.includes(c)) cleanTitles.push(c); };
    addTitle(title);
    const split = splitArtistFromTitle(title);
    if (split) { addTitle(split.title); if (!artist) titleArtists.push(cleanArtist(split.artist)); }

    const artists = Array.from(new Set([artist, ...titleArtists].filter(Boolean)));

    const TOTAL_MS = 12000;
    const PER_MS = 3500;
    const start = Date.now();
    let synced = '';
    let plain = '';

    for (const a of artists) {
      for (const t of cleanTitles) {
        if (Date.now() - start >= TOTAL_MS) break;
        const r = await tryLrclibGet(a, t, Math.min(PER_MS, TOTAL_MS - (Date.now() - start)));
        if (r && (r.synced || r.plain)) { synced = r.synced || ''; plain = r.plain || ''; break; }
        if (Date.now() - start >= TOTAL_MS) break;
        const s = await tryLrclibSearch(`${a} ${t}`, Math.min(PER_MS, TOTAL_MS - (Date.now() - start)));
        if (s && (s.synced || s.plain)) { synced = s.synced || ''; plain = s.plain || ''; break; }
      }
      if (synced || plain) break;
    }

    if (!synced && !plain) {
      for (const t of cleanTitles) {
        if (Date.now() - start >= TOTAL_MS) break;
        const s = await tryLrclibSearch(t, Math.min(PER_MS, TOTAL_MS - (Date.now() - start)));
        if (s && (s.synced || s.plain)) { synced = s.synced || ''; plain = s.plain || ''; break; }
      }
    }

    if (!plain) {
      for (const a of artists) {
        if (Date.now() - start >= TOTAL_MS) break;
        for (const t of cleanTitles) {
          if (Date.now() - start >= TOTAL_MS) break;
          const ovh = await tryOvh(a, t, Math.min(PER_MS, TOTAL_MS - (Date.now() - start)));
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
