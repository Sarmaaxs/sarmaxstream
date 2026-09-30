// api/_free.js — free music sources searched BEFORE YouTube: Audius + Jamendo.
// Env vars (set in Vercel, never commit them):
//   AUDIUS_API_KEY      Audius API key
//   JAMENDO_CLIENT_ID   Jamendo client id
// (The Audius API secret and Jamendo client secret are NOT needed for search/stream.)
//
// Track ids are prefixed so the player knows where to stream from:
//   aud_<audiusId>   ->  /api/stream?id=aud_...
//   jam_<jamendoId>  ->  /api/stream?id=jam_...
// Anything else is a YouTube video id.

const APP_NAME = 'sarmaxstream';

async function getJson(url, ms = 3500) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function secToIso(s) {
  s = Math.round(Number(s) || 0);
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `PT${h ? h + 'H' : ''}${m ? m + 'M' : ''}${sec ? sec + 'S' : ''}`;
}

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const JUNK = /remix|cover|slowed|sped up|nightcore|karaoke|reaction|tutorial|mashup|bootleg|\bedit\b/i;

// Every meaningful word of the search must appear in "artist + title".
function relevant(t, query) {
  const words = norm(query).split(' ').filter((w) => w.length > 1);
  if (!words.length) return true;
  const hay = norm(`${t.artist} ${t.title}`);
  return words.every((w) => hay.includes(w));
}

export async function searchAudius(query, limit) {
  const key = process.env.AUDIUS_API_KEY;
  if (!key) return [];
  const url = `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=${APP_NAME}&api_key=${encodeURIComponent(key)}`;
  const data = await getJson(url);
  return (data?.data || [])
    .filter((t) => t && t.id && t.is_streamable !== false && !t.is_unlisted && !t.stream_conditions)
    .map((t) => ({
      videoId: `aud_${t.id}`,
      title: t.title || 'Untitled',
      artist: t.user?.name || t.user?.handle || 'Unknown artist',
      thumbnail: t.artwork?.['480x480'] || t.artwork?.['150x150'] || t.artwork?.['1000x1000'] || '',
      duration: secToIso(t.duration),
      source: 'audius',
      verified: false,
    }));
}

export async function searchJamendo(query, limit) {
  const id = process.env.JAMENDO_CLIENT_ID;
  if (!id) return [];
  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(id)}&format=json&limit=${limit}&search=${encodeURIComponent(query)}&audioformat=mp31&imagesize=300&boost=popularity_total`;
  const data = await getJson(url);
  return (data?.results || [])
    .filter((t) => t && t.id && t.audio !== '' )
    .map((t) => ({
      videoId: `jam_${t.id}`,
      title: t.name || 'Untitled',
      artist: t.artist_name || 'Unknown artist',
      thumbnail: t.image || t.album_image || '',
      duration: secToIso(t.duration),
      source: 'jamendo',
      verified: false,
    }));
}

// Audius + Jamendo in parallel, junk filtered, interleaved so both show up.
export async function searchFree(query, max = 24) {
  const per = Math.min(Math.max(max, 10), 30);
  const [a, j] = await Promise.all([
    searchAudius(query, per).catch(() => []),
    searchJamendo(query, per).catch(() => []),
  ]);
  const ok = (t) => relevant(t, query) && (!JUNK.test(`${t.title}`) || JUNK.test(query));
  const A = a.filter(ok), J = j.filter(ok);
  const out = [];
  for (let i = 0; i < Math.max(A.length, J.length); i++) {
    if (J[i]) out.push(J[i]);
    if (A[i]) out.push(A[i]);
  }
  return out.slice(0, max);
}
