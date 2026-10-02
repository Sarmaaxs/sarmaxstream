// api/_catalog.js — song SEARCH from free catalogs that have no daily quota:
// Deezer (primary) and iTunes (backup). They return metadata only (title, artist, cover, length).
// Playback is resolved later, per click, by /api/resolve (Audius -> Jamendo -> YouTube).
//
// Ids:  dz_<deezerId>  /  it_<itunesId>   (digits only, so they can never look like a YouTube id)

async function getJson(url, ms = 5000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

const secToIso = (s) => {
  s = Math.round(Number(s) || 0);
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `PT${h ? h + 'H' : ''}${m ? m + 'M' : ''}${sec ? sec + 'S' : ''}`;
};
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const FAKE = /karaoke|tribute|made famous|originally performed|in the style of|cover version|8d audio|nightcore|sped up|slowed|lullaby|piano version|workout/i;

async function deezer(query, limit) {
  const d = await getJson(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  return ((d && d.data) || [])
    .filter((t) => t && t.id && t.title && t.artist)
    .map((t) => ({
      videoId: `dz_${t.id}`,
      title: t.title,
      artist: t.artist.name || 'Unknown artist',
      thumbnail: (t.album && (t.album.cover_medium || t.album.cover_big || t.album.cover)) || '',
      duration: secToIso(t.duration),
      source: 'catalog',
      verified: false,
    }));
}

async function itunes(query, limit) {
  const d = await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}`);
  return ((d && d.results) || [])
    .filter((t) => t && t.trackId && t.trackName)
    .map((t) => ({
      videoId: `it_${t.trackId}`,
      title: t.trackName,
      artist: t.artistName || 'Unknown artist',
      thumbnail: (t.artworkUrl100 || '').replace('100x100', '300x300'),
      duration: secToIso((t.trackTimeMillis || 0) / 1000),
      source: 'catalog',
      verified: false,
    }));
}

export async function searchCatalog(query, max = 25) {
  let list = await deezer(query, Math.min(max + 10, 50));
  if (list.length < 3) {
    const alt = await itunes(query, Math.min(max + 10, 50));
    list = [...list, ...alt];
  }
  const wantFake = FAKE.test(query);
  const seen = new Set();
  const out = [];
  for (const t of list) {
    if (!wantFake && FAKE.test(`${t.title} ${t.artist}`)) continue;
    const k = `${norm(t.artist)}|${norm(t.title).replace(/ (remaster|remastered|radio edit|single version|album version).*$/, '')}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
