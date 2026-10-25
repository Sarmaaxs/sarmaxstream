// api/_free.js — free music sources searched BEFORE YouTube: Audius + Jamendo.
// Env vars (set in Vercel, never commit them):
//   AUDIUS_API_KEY      Audius API key
//   JAMENDO_CLIENT_ID   Jamendo client id
// (The Audius API secret and Jamendo client secret are NOT needed for search/stream.)
//
// Track ids are prefixed so the player knows where to stream from:
//   aud_<audiusId>   ->  /api/stream?id=aud_...
//   jam_<jamendoId>  ->  /api/stream?id=jam_...
//   ia_<identifier>  ->  /api/stream?id=ia_...   (Internet Archive, Creative Commons / public domain)
//   ov_<uuid>        ->  /api/stream?id=ov_...   (Openverse, Creative Commons)
// Anything else is a YouTube video id.

const APP_NAME = 'sarmaxstream';

// Returns { data, why }: data is the parsed JSON (or null), why says what went wrong.
async function getJson(url, ms = 6000, extraHeaders) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json', 'User-Agent': 'sarmaxstream/1.0', ...(extraHeaders || {}) } });
    if (!r.ok) return { data: null, why: `HTTP ${r.status}` };
    return { data: await r.json(), why: 'ok' };
  } catch (e) {
    return { data: null, why: e && e.name === 'AbortError' ? 'timed out' : 'network error' };
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
const JUNK = /remix|\bcover\b|slowed|sped up|nightcore|karaoke|reaction|tutorial|mashup|bootleg|\bedit\b|type beat|instrumental|\bflip\b|rework|\bvip\b|lo-?fi|reverb|\b8d\b|bass boost|parody|tribute|unofficial|freestyle|\bprod\b|beat by|\bmix\b|version|acoustic|live at|demo|snippet|leak|cypher|challenge/i;
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'feat', 'ft', 'by']);

const qWords = (query) => norm(query).split(' ').filter((w) => w.length > 1);

// Every meaningful word of the search must appear in "artist + title".
function relevant(t, query) {
  const words = qWords(query);
  if (!words.length) return true;
  const hay = norm(`${t.artist} ${t.title}`);
  return words.every((w) => hay.includes(w));
}

// The searched name IS the uploader (e.g. "the weeknd" -> artist "The Weeknd").
function artistMatches(t, query) {
  const words = qWords(query).filter((w) => !STOP.has(w));
  if (!words.length) return false;
  const a = norm(t.artist);
  return words.every((w) => a.includes(w));
}

// Only keep free-source tracks that look like the real thing:
//  Audius: verified artist, or the artist name matches AND the track is genuinely popular.
//  Jamendo: artist name or title matches (its catalog is real independent music).
function official(t, query) {
  if (!relevant(t, query)) return false;
  if (JUNK.test(t.title) && !JUNK.test(query)) return false;
  if (t.source === 'audius') return t._verified || (artistMatches(t, query) && (t._plays || 0) >= 20000);
  return true;
}

export async function searchAudius(query, limit) {
  const key = process.env.AUDIUS_API_KEY;
  const base = `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=${APP_NAME}`;
  // Try with the key; if Audius rejects it, retry without (search is public).
  let r = key ? await getJson(`${base}&api_key=${encodeURIComponent(key)}`) : { data: null, why: 'no AUDIUS_API_KEY' };
  if (!r.data) {
    const r2 = await getJson(base);
    if (r2.data) r = { data: r2.data, why: key ? `ok (key rejected: ${r.why})` : 'ok (no key)' };
  }
  const items = ((r.data && r.data.data) || [])
    .filter((t) => t && t.id && t.is_streamable !== false && !t.is_unlisted && !t.stream_conditions)
    .map((t) => ({
      videoId: `aud_${t.id}`,
      title: t.title || 'Untitled',
      artist: (t.user && (t.user.name || t.user.handle)) || 'Unknown artist',
      thumbnail: (t.artwork && (t.artwork['480x480'] || t.artwork['150x150'] || t.artwork['1000x1000'])) || '',
      duration: secToIso(t.duration),
      source: 'audius',
      verified: false,
      _verified: !!(t.user && t.user.is_verified),
      _plays: Number(t.play_count) || 0,
    }));
  return { items, why: r.why };
}

export async function searchJamendo(query, limit) {
  const id = process.env.JAMENDO_CLIENT_ID;
  if (!id) return { items: [], why: 'no JAMENDO_CLIENT_ID' };
  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(id)}&format=json&limit=${limit}&search=${encodeURIComponent(query)}&audioformat=mp31&imagesize=300&boost=popularity_total`;
  const r = await getJson(url);
  let why = r.why;
  const h = r.data && r.data.headers;
  if (h && h.status === 'failed') why = `Jamendo: ${h.error_message || 'request failed'}`;
  const items = ((r.data && r.data.results) || [])
    .filter((t) => t && t.id)
    .map((t) => ({
      videoId: `jam_${t.id}`,
      title: t.name || 'Untitled',
      artist: t.artist_name || 'Unknown artist',
      thumbnail: t.image || t.album_image || '',
      duration: secToIso(t.duration),
      source: 'jamendo',
      license: ccLabel(t.license_ccurl),
      verified: false,
    }));
  return { items, why };
}

// ---------------------------------------------------------------------------
// Internet Archive + Openverse: openly licensed music.
// The site shows ads, so NonCommercial (NC) licences are excluded from both sources.
// Optional env: OPENVERSE_CLIENT_ID + OPENVERSE_CLIENT_SECRET (free) raise Openverse's rate limit.
// ---------------------------------------------------------------------------
const IA_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const OV_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CC_URL = /^https?:\/\/(?:www\.)?creativecommons\.org\//i;
const isNC = (s) => /(^|[/_\s-])nc([/_\s-]|$)/i.test(String(s || ''));
const first = (v) => (Array.isArray(v) ? v[0] : v);

// "http://creativecommons.org/licenses/by-sa/4.0/" -> "CC BY-SA 4.0";  Openverse code "by", "4.0" -> "CC BY 4.0"
function ccLabel(urlOrCode, version) {
  const s = String(urlOrCode || '');
  if (!s) return '';
  const m = /\/licenses\/([a-z-]+)\/([\d.]+)/i.exec(s);
  if (m) return `CC ${m[1].toUpperCase()} ${m[2]}`;
  if (/publicdomain\/zero|\bcc0\b|\/zero\//i.test(s)) return 'CC0';
  if (/publicdomain|\bpdm\b/i.test(s)) return 'Public domain';
  if (/^[a-z-]{2,12}$/i.test(s)) return `CC ${s.toUpperCase()}${version ? ' ' + version : ''}`;
  return 'Creative Commons';
}

export async function searchArchive(query, limit) {
  const words = qWords(query).filter((w) => !STOP.has(w) && !['or', 'not', 'to'].includes(w)).slice(0, 6);
  if (!words.length) return { items: [], why: 'empty query' };
  const q = `(${words.join(' AND ')}) AND mediatype:audio AND licenseurl:http*creativecommons.org*`;
  const u = new URL('https://archive.org/advancedsearch.php');
  u.searchParams.set('q', q);
  for (const f of ['identifier', 'title', 'creator', 'licenseurl']) u.searchParams.append('fl[]', f);
  u.searchParams.append('sort[]', 'downloads desc');
  u.searchParams.set('rows', String(Math.min(limit * 2, 50)));
  u.searchParams.set('page', '1');
  u.searchParams.set('output', 'json');
  const r = await getJson(u.toString(), 6500);
  const docs = (r.data && r.data.response && r.data.response.docs) || [];
  const items = docs
    .filter((d) => d && IA_ID.test(String(d.identifier || '')) && CC_URL.test(String(first(d.licenseurl) || '')) && !isNC(first(d.licenseurl)))
    .slice(0, limit)
    .map((d) => ({
      videoId: `ia_${d.identifier}`,
      title: String(first(d.title) || 'Untitled').slice(0, 200),
      artist: String(first(d.creator) || 'Unknown artist').slice(0, 120),
      thumbnail: `https://archive.org/services/img/${d.identifier}`,
      duration: '',
      source: 'archive',
      license: ccLabel(first(d.licenseurl)),
      verified: false,
    }));
  return { items, why: r.why };
}

// Picks the best MP3 of an archive.org item. Re-checks the licence, so an id typed by hand
// can never be used to pull an unlicensed or NonCommercial item through this server.
export async function archiveFileUrl(identifier) {
  if (!IA_ID.test(String(identifier || ''))) return null;
  const r = await getJson(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, 7000);
  const d = r.data;
  if (!d || !d.metadata) return null;
  const lic = String(first(d.metadata.licenseurl) || '');
  if (!CC_URL.test(lic) || isNC(lic)) return null;
  const files = Array.isArray(d.files) ? d.files : [];
  for (const fmt of ['VBR MP3', '128Kbps MP3', '64Kbps MP3', 'MP3', 'Ogg Vorbis']) {
    const f = files.find((x) => x && x.format === fmt && x.name);
    if (f) return `https://archive.org/download/${encodeURIComponent(identifier)}/${String(f.name).split('/').map(encodeURIComponent).join('/')}`;
  }
  return null;
}

let ovTok = { v: null, exp: 0 };
async function openverseAuth() {
  const id = process.env.OPENVERSE_CLIENT_ID;
  const secret = process.env.OPENVERSE_CLIENT_SECRET;
  if (!id || !secret) return undefined;
  if (ovTok.v && Date.now() < ovTok.exp) return { Authorization: `Bearer ${ovTok.v}` };
  try {
    const r = await fetch('https://api.openverse.org/v1/auth_tokens/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'sarmaxstream/1.0' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }).toString(),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return undefined;
    const d = await r.json();
    if (!d || !d.access_token) return undefined;
    ovTok = { v: d.access_token, exp: Date.now() + Math.max(60, (Number(d.expires_in) || 3600) - 120) * 1000 };
    return { Authorization: `Bearer ${ovTok.v}` };
  } catch { return undefined; }
}

export async function searchOpenverse(query, limit) {
  const u = new URL('https://api.openverse.org/v1/audio/');
  u.searchParams.set('q', query);
  u.searchParams.set('page_size', String(Math.min(limit, 20)));
  u.searchParams.set('license_type', 'commercial');
  u.searchParams.set('category', 'music');
  const r = await getJson(u.toString(), 6500, await openverseAuth());
  const items = ((r.data && r.data.results) || [])
    .filter((t) => t && OV_ID.test(String(t.id || '')) && t.url && !isNC(t.license))
    .map((t) => ({
      videoId: `ov_${t.id}`,
      title: String(t.title || 'Untitled').slice(0, 200),
      artist: String(t.creator || 'Unknown artist').slice(0, 120),
      thumbnail: t.thumbnail || '',
      duration: secToIso((Number(t.duration) || 0) / 1000),
      source: 'openverse',
      license: ccLabel(t.license, t.license_version),
      verified: false,
    }));
  return { items, why: r.why };
}

// Looks the real audio file up on Openverse (never taken from the caller). https only.
export async function openverseAudioUrl(uuid) {
  if (!OV_ID.test(String(uuid || ''))) return null;
  const r = await getJson(`https://api.openverse.org/v1/audio/${uuid}/`, 6500, await openverseAuth());
  const d = r.data;
  if (!d || !d.url || isNC(d.license)) return null;
  try {
    const u = new URL(d.url);
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.hostname.includes(':') || /^[\d.]+$/.test(u.hostname)) return null;
    return u.toString();
  } catch { return null; }
}

// All four free sources in parallel, junk filtered, interleaved so each one shows up.
// Returns { tracks, diag } where diag explains what each source did.
export async function searchFree(query, max = 24) {
  const per = Math.min(Math.max(max, 10), 30);
  const empty = { items: [], why: 'crashed' };
  const [a, j, o, i] = await Promise.all([
    searchAudius(query, per).catch(() => empty),
    searchJamendo(query, per).catch(() => empty),
    searchOpenverse(query, per).catch(() => empty),
    searchArchive(query, per).catch(() => empty),
  ]);
  const lists = [j, a, o, i].map((s) => s.items.filter((t) => official(t, query)));
  const longest = Math.max(0, ...lists.map((l) => l.length));
  const seen = new Set();
  const out = [];
  for (let k = 0; k < longest; k++) {
    for (const l of lists) {
      const t = l[k];
      if (!t) continue;
      const key = `${norm(t.artist)}|${norm(t.title)}`; // Openverse also carries Jamendo tracks
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return {
    tracks: out.slice(0, max).map(({ _verified, _plays, ...t }) => t),
    diag: {
      audius: `${a.why} (${a.items.length} found)`,
      jamendo: `${j.why} (${j.items.length} found)`,
      openverse: `${o.why} (${o.items.length} found)`,
      archive: `${i.why} (${i.items.length} found)`,
    },
  };
}
