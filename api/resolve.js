// api/resolve.js — GET /api/resolve?artist=..&title=..&dur=SECONDS[&skip=free]
// Finds a PLAYABLE source for a catalog song, in this order:
//   1. Audius   (verified / clearly the same artist, same title)
//   2. Jamendo  (same artist, same title)
//   3. YouTube  (one search, cached for 30 days, so quota is only spent once per song)
// Returns { videoId, source } where videoId is aud_… / jam_… / a YouTube id.
import { rateLimit, makeCache } from './_guard.js';

const cache = makeCache({ ttlMs: 24 * 60 * 60 * 1000, max: 2000 });

async function getJson(url, ms = 4500) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
// "Blinding Lights (feat. X) - Remastered" -> "blinding lights"
const baseTitle = (s) => norm((s || '').replace(/[\(\[].*?[\)\]]/g, ' ').replace(/ - .*$/, ' '));
const mainArtist = (s) => norm((s || '').split(/,| feat\.?| ft\.?| & | x | with /i)[0]);
const JUNK = /remix|\bcover\b|slowed|sped up|nightcore|karaoke|reaction|mashup|bootleg|type beat|instrumental|\bflip\b|rework|lo-?fi|reverb|\b8d\b|bass boost|parody|tribute|unofficial|freestyle|live at|demo|snippet|leak/i;

function titleOk(candTitle, wantTitle, query) {
  const w = baseTitle(wantTitle);
  const c = baseTitle(candTitle);
  if (!w || !c) return false;
  if (JUNK.test(candTitle) && !JUNK.test(wantTitle) && !JUNK.test(query || '')) return false;
  return c === w || (c.includes(w) && c.length <= w.length + 12);
}
function artistOk(candArtist, wantArtist) {
  const a = mainArtist(wantArtist);
  const words = a.split(' ').filter((x) => x.length > 1 && x !== 'the');
  if (!words.length) return false;
  const c = norm(candArtist);
  return words.every((x) => c.includes(x));
}
function durOk(candSec, wantSec) {
  if (!wantSec || !candSec) return true;
  return Math.abs(candSec - wantSec) <= 12;
}

async function tryAudius(artist, title, dur) {
  const key = process.env.AUDIUS_API_KEY;
  const q = encodeURIComponent(`${mainArtist(artist)} ${baseTitle(title)}`);
  const base = `https://api.audius.co/v1/tracks/search?query=${q}&limit=15&app_name=sarmaxstream`;
  let d = key ? await getJson(`${base}&api_key=${encodeURIComponent(key)}`) : null;
  if (!d) d = await getJson(base);
  for (const t of (d && d.data) || []) {
    if (!t || !t.id || t.is_streamable === false || t.is_unlisted || t.stream_conditions) continue;
    const who = (t.user && (t.user.name || t.user.handle)) || '';
    const trusted = (t.user && t.user.is_verified) || (Number(t.play_count) || 0) >= 20000;
    if (trusted && artistOk(who, artist) && titleOk(t.title, title, '') && durOk(t.duration, dur)) return `aud_${t.id}`;
  }
  return null;
}

async function tryJamendo(artist, title, dur) {
  const id = process.env.JAMENDO_CLIENT_ID;
  if (!id) return null;
  const q = encodeURIComponent(`${mainArtist(artist)} ${baseTitle(title)}`);
  const d = await getJson(`https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(id)}&format=json&limit=15&search=${q}&audioformat=mp31`);
  for (const t of (d && d.results) || []) {
    if (!t || !t.id) continue;
    if (artistOk(t.artist_name, artist) && titleOk(t.name, title, '') && durOk(Number(t.duration), dur)) return `jam_${t.id}`;
  }
  return null;
}

async function tryYouTube(artist, title) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  const q = encodeURIComponent(`${mainArtist(artist)} ${baseTitle(title)} official audio`);
  const d = await getJson(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&q=${q}&maxResults=5&key=${key}`, 6000);
  const items = ((d && d.items) || []).filter((v) => v && v.id && v.id.videoId);
  const want = baseTitle(title);
  const clean = items.filter((v) => !JUNK.test((v.snippet && v.snippet.title) || '') || JUNK.test(title));
  const best = clean.find((v) => norm((v.snippet && v.snippet.title) || '').includes(want)) || clean[0] || items[0];
  return best ? best.id.videoId : null;
}

// Persistent cache in Supabase (table playback_cache). Misses expire after 24h, hits never do.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel (server-side only, never VITE_).
const MISS_TTL_MS = 24 * 60 * 60 * 1000;
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function dbGet(ck) {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/playback_cache?cache_key=eq.${encodeURIComponent(ck)}&select=video_id,source,created_at`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows && rows[0] ? rows[0] : null;
  } catch { return null; }
}

async function dbSet(ck, out) {
  if (!SB_URL || !SB_KEY) return;
  try {
    await fetch(`${SB_URL}/rest/v1/playback_cache?on_conflict=cache_key`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ cache_key: ck, video_id: out.videoId || null, source: out.source, created_at: new Date().toISOString() }),
    });
  } catch {}
}

export default async function handler(req, res) {
  const q = req.query || {};
  const artist = String(q.artist || '').slice(0, 120);
  const title = String(q.title || '').slice(0, 160);
  const dur = Math.max(0, Math.min(3600, parseInt(q.dur, 10) || 0));
  const skipFree = q.skip === 'free';
  if (!title) return res.status(400).json({ error: 'Missing title' });

  const ck = JSON.stringify([norm(artist), baseTitle(title), skipFree]);
  const sendOk = (out) => {
    res.setHeader('Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=86400');
    return res.status(200).json(out);
  };
  const notFound = () => res.status(404).json({ error: 'No playable source found' });

  // 1) Memory (this server instance)
  const hit = cache.get(ck);
  if (hit) return hit.videoId ? sendOk(hit) : notFound();

  // 2) Supabase (shared by all instances, survives restarts)
  const row = await dbGet(ck);
  if (row && (row.video_id || Date.now() - Date.parse(row.created_at) < MISS_TTL_MS)) {
    const out = row.video_id ? { videoId: row.video_id, source: row.source } : { videoId: null, source: 'none' };
    cache.set(ck, out);
    return out.videoId ? sendOk(out) : notFound();
  }

  // 3) Live lookup: free sources first, YouTube last
  if (!rateLimit(req, res, { name: 'resolve', max: 60, windowMs: 60 * 1000 })) return undefined;

  let out = null;
  if (!skipFree) {
    const [a, j] = await Promise.all([tryAudius(artist, title, dur).catch(() => null), tryJamendo(artist, title, dur).catch(() => null)]);
    if (a) out = { videoId: a, source: 'audius' };
    else if (j) out = { videoId: j, source: 'jamendo' };
  }
  if (!out) {
    const yt = await tryYouTube(artist, title).catch(() => null);
    if (yt) out = { videoId: yt, source: 'youtube' };
  }
  if (!out) out = { videoId: null, source: 'none' };

  cache.set(ck, out);
  await dbSet(ck, out);
  return out.videoId ? sendOk(out) : notFound();
}
