// api/searchMusic.js — REPLACES base44/functions/searchMusic/entry.ts
// Deploy target: Vercel serverless function (drop straight in /api on Vercel)
// or Railway/Express (wrap the handler in an app.post route — same body).
//
// Env var needed: YOUTUBE_API_KEY  (set in Vercel/Railway project settings,
// NOT in a committed .env file).
//
// Call it the same way you called base44.functions.invoke('searchMusic', body):
//   fetch('/api/searchMusic', { method: 'POST', body: JSON.stringify(body) })
//
// NEW vs. the Base44 version:
//   - Shorts filter fix (see searchMusic-shorts-fix.md for the isolated diff)
//   - "Real results" verification: for mode:'search', cross-checks results
//     against Apple's free iTunes Search API (no key required) to confirm
//     the track actually exists as a released song, not just a YouTube
//     upload with a song-like title. Verified matches get `verified: true`
//     and are sorted first. This only fires ONCE per search submit (not per
//     keystroke) — one extra network call, not per-result, so it stays fast
//     and won't hit iTunes' rate limits.

import { rateLimit, makeCache, parseBody } from './_guard.js';
import { searchFree } from './_free.js';
import { searchCatalog } from './_catalog.js';

const HARD_JUNK = /reaction|\b8d audio\b|slowed|sped up|nightcore|tutorial|karaoke|behind the scenes|full album|compilation|\b1 hour\b|\b1hr\b|greatest hits|best of|beatport|discograph/i;
const SOFT_JUNK = /lyric|cover|remix|live at|acoustic|instrumental/i;
const SHORTS_TAG = /#shorts?\b/i;

function decodeHtml(s) {
  if (!s) return '';
  return s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function cleanTitle(title) {
  if (!title) return '';
  return decodeHtml(title)
    .replace(/\(.*?(official|video|audio|lyric|lyrics|visualizer|visualiser|hd|4k|mv|music video|remaster|explicit|clean|performance|color coded|karaoke).*?\)/gi, '')
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
  return decodeHtml(artist)
    .replace(/\s*-\s*topic\s*$/i, '')
    .replace(/\s*vevo$/i, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\bofficial\b/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normTitle(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isoToSeconds(iso) {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

function isJunk(rawTitle, query, includeSoft) {
  if (!rawTitle) return false;
  if (SHORTS_TAG.test(rawTitle)) return true;
  if (HARD_JUNK.test(rawTitle) && !HARD_JUNK.test(query || '')) return true;
  if (includeSoft && SOFT_JUNK.test(rawTitle) && !SOFT_JUNK.test(query || '')) return true;
  return false;
}

function isReasonableLength(durSeconds) {
  return durSeconds >= 45 && durSeconds <= 600;
}

function buildTrack({ videoId, rawTitle, channelTitle, thumbnail, durationIso, views, idx }) {
  return {
    videoId,
    title: cleanTitle(rawTitle),
    artist: cleanArtist(channelTitle || ''),
    thumbnail: thumbnail || '',
    duration: durationIso || '',
    _rawTitle: rawTitle || '',
    _isTopic: /-\s*topic$/i.test(channelTitle || ''),
    _views: views || 0,
    _idx: idx == null ? 0 : idx,
  };
}

function dedupeTracks(tracks) {
  const byVid = new Set();
  const groups = new Map();
  for (const t of tracks) {
    if (!t.videoId || byVid.has(t.videoId)) continue;
    byVid.add(t.videoId);
    const key = `${t.artist.toLowerCase()}|${normTitle(t.title)}`;
    const cur = groups.get(key);
    const score = (x) => (x._isTopic ? 1e12 : 0) + (x._views || 0);
    if (!cur || score(t) > score(cur)) groups.set(key, t);
  }
  return Array.from(groups.values());
}

function stripInternal(t) {
  const { _rawTitle, _isTopic, _views, _idx, ...rest } = t;
  return rest;
}

// --- "real results" verification via Apple's free iTunes Search API ---
// No key required. One call per search submit. If it fails or times out,
// we degrade gracefully to the unverified (but already junk-filtered) list.
async function fetchITunesVerifiedSet(query, ms = 2500) {
  const verified = new Set(); // holds `${normArtist}|${normTitle}`
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const url = `https://itunes.apple.com/search?media=music&entity=song&limit=15&term=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return verified;
    const data = await res.json();
    for (const r of data.results || []) {
      const key = `${(r.artistName || '').toLowerCase().replace(/[^a-z0-9]/g, '')}|${normTitle(r.trackName)}`;
      verified.add(key);
    }
  } catch {
    // network hiccup or timeout — just skip verification, don't fail the search
  }
  return verified;
}

// Real-artist check: Apple's free iTunes API lists actual recording artists.
// YouTube "channel" search returns fan pages, re-uploaders and fake accounts,
// so we only keep channels whose name matches a real artist.
function normName(n) {
  return (n || '').toLowerCase()
    .replace(/\s*-\s*topic\s*$/i, '')
    .replace(/\s*vevo\s*$/i, '')
    .replace(/\bofficial\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function fetchITunesArtistSet(query, ms = 2500) {
  const names = new Set();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const url = `https://itunes.apple.com/search?media=music&entity=musicArtist&limit=15&term=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return names;
    const data = await res.json();
    for (const r of data.results || []) names.add(normName(r.artistName));
  } catch {}
  return names;
}

// Curated Billboard Hot 100 list (checked against billboard.com for the week
// of Sept 26, 2026). Resolved to real YouTube videos below.
const FAMOUS_CHART = [
  { title: "Choosin' Texas", artist: 'Ella Langley' },
  { title: 'Boston', artist: 'Stella Lefty' },
  { title: 'Been By Now', artist: 'Morgan Wallen' },
  { title: 'Hate That I Made You Love Me', artist: 'Ariana Grande' },
  { title: 'Dracula', artist: 'Tame Impala & JENNIE' },
  { title: 'I Knew It, I Knew You', artist: 'Taylor Swift' },
  { title: 'BbY WOW', artist: 'Karol G, Judeline & rusowsky' },
  { title: 'So Easy (To Fall In Love)', artist: 'Olivia Dean' },
  { title: 'Man I Need', artist: 'Olivia Dean' },
  { title: 'Be Her', artist: 'Ella Langley' },
  { title: 'Risk It All', artist: 'Bruno Mars' },
  { title: 'Stupid Song', artist: 'Olivia Rodrigo' },
  { title: 'I Just Might', artist: 'Bruno Mars' },
  { title: 'Midnight Sun', artist: 'Zara Larsson' },
  { title: "I Can't Love You Anymore", artist: 'Ella Langley & Morgan Wallen' },
  { title: 'Drop Dead', artist: 'Olivia Rodrigo' },
  { title: 'Be By You', artist: 'Luke Combs' },
  { title: 'Janice STFU', artist: 'Drake' },
  { title: 'Babydoll', artist: 'Dominic Fike' },
  { title: 'Earrings', artist: 'Malcolm Todd' },
  { title: 'Dead Fresh', artist: 'Lil Baby' },
  { title: 'Nicole Kidman', artist: 'ADÉLA' },
  { title: 'Loser', artist: 'Tame Impala' },
  { title: 'Loving Life Again', artist: 'Ella Langley' },
  { title: 'Jaded', artist: 'Koe Wetzel & Ella Langley' },
  { title: 'So Good', artist: 'Jhené Aiko feat. Kendrick Lamar' },
  { title: 'The Cure', artist: 'Olivia Rodrigo' },
  { title: 'Animal', artist: 'KATSEYE' },
];

// Two cache layers so the chart (28 x 100 = 2,800 quota units to resolve)
// isn't re-resolved on every cold start / deploy-preview / page load:
//  1) module-scope memory (per warm serverless instance), 24h
//  2) Vercel's CDN via Cache-Control on GET /api/searchMusic?mode=chart, 3 days
let chartCache = { ts: 0, tracks: [] };
const CHART_CACHE_MS = 24 * 60 * 60 * 1000;
const CHART_CDN_HEADER = 'public, s-maxage=259200, stale-while-revalidate=86400';

async function inner(req, res) {
  // Works as a Vercel Node function (req/res). For Express/Railway, mount
  // as: app.post('/api/searchMusic', (req, res) => handler(req, res))
  try {
    // POST (JSON body) for everything, GET (?mode=chart) so the CDN can cache the chart.
    const body = req.method === 'GET'
      ? (req.query || {})
      : (req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}'));
    const query = (body.query || '').trim();
    const mode = body.mode || 'search';
    const pageToken = body.pageToken || '';
    const maxResults = Math.min(Number(body.maxResults) || 24, 50);
    const channelId = body.channelId || '';
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'YouTube API key not configured' });

    // "Famous Songs" home section: merge a couple of regions' music charts so
    // it isn't just one country's algorithmic trending list. Cheap: 1 quota
    // unit per region (videos.list), not the 100-unit search endpoint.
    if (mode === 'trending') {
      const regions = ['US', 'GB'];
      const perRegion = Math.min(maxResults, 50);
      const regionResults = await Promise.all(regions.map((r) =>
        fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&chart=mostPopular&videoCategoryId=10&regionCode=${r}&maxResults=${perRegion}&key=${apiKey}`)
          .then((res2) => res2.json())
          .catch(() => ({ items: [] }))
      ));
      const seenIds = new Set();
      const merged = [];
      for (const d of regionResults) {
        for (const it of d.items || []) {
          if (it.id && !seenIds.has(it.id)) { seenIds.add(it.id); merged.push(it); }
        }
      }
      let tracks = merged.map((it, i) => buildTrack({
        videoId: it.id,
        rawTitle: it.snippet?.title,
        channelTitle: it.snippet?.channelTitle,
        thumbnail: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url,
        durationIso: it.contentDetails?.duration,
        views: Number(it.statistics?.viewCount || 0),
        idx: i,
      }))
        .filter((t) => !isJunk(t._rawTitle, '', true))
        .filter((t) => isReasonableLength(isoToSeconds(t.duration)));
      tracks.sort((a, b) => b._views - a._views);
      tracks = dedupeTracks(tracks);
      tracks.sort((a, b) => b._views - a._views);
      tracks = tracks.slice(0, maxResults).map((t) => ({ ...stripInternal(t), verified: false }));
      return res.status(200).json({ tracks, artist: null, nextPageToken: '' });
    }

    // Real Billboard Hot 100 list, resolved to actual YouTube videos.
    if (mode === 'chart') {
      if (chartCache.tracks.length && Date.now() - chartCache.ts < CHART_CACHE_MS) {
        res.setHeader('Cache-Control', CHART_CDN_HEADER);
        return res.status(200).json({ tracks: chartCache.tracks, artist: null, nextPageToken: '' });
      }
      let firstError = '';
      const resolved = await Promise.all(FAMOUS_CHART.map(async ({ title, artist }) => {
        try {
          const q = `${artist} ${title}`;
          const sres = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(q)}&maxResults=1&key=${apiKey}`);
          const sdata = await sres.json();
          if (!sres.ok) {
            if (!firstError) firstError = sdata.error?.message || `YouTube API error ${sres.status}`;
            return null;
          }
          const item = sdata.items?.[0];
          if (!item?.id?.videoId) return null;
          return {
            videoId: item.id.videoId,
            title,
            artist,
            thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
            duration: '',
          };
        } catch (e) {
          if (!firstError) firstError = e.message || 'Request failed';
          return null;
        }
      }));
      const seenIds = new Set();
      let tracks = resolved.filter((t) => t && !seenIds.has(t.videoId) && seenIds.add(t.videoId));

      if (tracks.length === 0) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(502).json({ error: firstError || 'No chart tracks found', tracks: [] });
      }

      const ids = tracks.map((t) => t.videoId).join(',');
      try {
        const dres = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${apiKey}`);
        const ddata = await dres.json();
        const durMap = {};
        (ddata.items || []).forEach((it) => { durMap[it.id] = it.contentDetails?.duration || ''; });
        tracks = tracks.map((t) => ({ ...t, duration: durMap[t.videoId] || '' }));
      } catch {}

      tracks = tracks.map((t) => ({ ...t, verified: true }));

      // Only cache a (mostly) complete chart — never pin a half-failed one for days.
      if (tracks.length >= Math.ceil(FAMOUS_CHART.length * 0.7)) {
        chartCache = { ts: Date.now(), tracks };
        res.setHeader('Cache-Control', CHART_CDN_HEADER);
      } else {
        res.setHeader('Cache-Control', 'no-store');
      }
      return res.status(200).json({ tracks, artist: null, nextPageToken: '' });
    }

    let url;
    if (mode === 'artists') {
      if (!query) return res.status(200).json({ artists: [] });
      url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${apiKey}`;
    } else if (mode === 'artistSongs') {
      if (!channelId) return res.status(200).json({ tracks: [], artist: null });
      url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&channelId=${encodeURIComponent(channelId)}&order=date&maxResults=${maxResults}&key=${apiKey}`;
    } else {
      if (!query) return res.status(200).json({ tracks: [], nextPageToken: '' });
      url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${apiKey}`;
    }
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

    const [ytRes, verifiedSet] = await Promise.all([
      fetch(url),
      mode === 'search' && query ? fetchITunesVerifiedSet(query) : Promise.resolve(new Set()),
    ]);
    const artistSetPromise = mode === 'artists' && query ? fetchITunesArtistSet(query) : Promise.resolve(new Set());
    const data = await ytRes.json();
    if (!ytRes.ok) return res.status(ytRes.status).json({ error: data.error?.message || 'YouTube API error' });

    if (mode === 'artists') {
      const q = query.toLowerCase();
      const raw = (data.items || []).map((it) => ({
        channelId: it.id?.channelId || it.id,
        title: decodeHtml(it.snippet?.title),
        thumbnail: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || '',
      })).filter((a) => a.channelId);

      const subs = {};
      const ids = raw.map((a) => a.channelId).join(',');
      if (ids) {
        try {
          const cres = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${ids}&key=${apiKey}`);
          const cdata = await cres.json();
          (cdata.items || []).forEach((it) => { subs[it.id] = Number(it.statistics?.subscriberCount || 0); });
        } catch {}
      }

      const realNames = await artistSetPromise;
      const seen = new Set();
      const artists = raw
        .map((a) => ({ ...a, subs: subs[a.channelId] || 0 }))
        .filter((a) => {
          const t = a.title.toLowerCase();
          const isTopic = t.includes('- topic');
          // Real artist = name matches an actual recording artist (iTunes),
          // or the channel is huge. If iTunes was unreachable, fall back to a size check.
          if (realNames.size > 0) {
            return realNames.has(normName(a.title)) || a.subs >= 2000000;
          }
          if (isTopic) return a.subs >= 100000;
          return a.subs >= 100000;
        })
        .filter((a) => {
          const key = normName(a.title);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      artists.sort((a, b) => {
        const at = a.title.toLowerCase(), bt = b.title.toLowerCase();
        const rank = (t) => (t === q ? 0 : t.startsWith(q) ? 1 : t.includes(q) ? 2 : 3);
        const ra = rank(at), rb = rank(bt);
        if (ra !== rb) return ra - rb;
        return b.subs - a.subs;
      });

      return res.status(200).json({ artists: artists.map(({ subs, ...rest }) => rest) });
    }

    const includeSoft = mode !== 'artistSongs';
    const strictDuration = mode !== 'artistSongs';
    let tracks;

    {
      const ids = (data.items || []).map((it) => it.id?.videoId).filter(Boolean).join(',');
      const durMap = {};
      const viewsMap = {};
      if (ids) {
        const dres = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${ids}&key=${apiKey}`);
        const ddata = await dres.json();
        (ddata.items || []).forEach((it) => {
          durMap[it.id] = it.contentDetails?.duration || '';
          viewsMap[it.id] = Number(it.statistics?.viewCount || 0);
        });
      }
      tracks = (data.items || []).map((it, i) => buildTrack({
        videoId: it.id?.videoId,
        rawTitle: it.snippet?.title,
        channelTitle: it.snippet?.channelTitle,
        thumbnail: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url,
        durationIso: durMap[it.id?.videoId] || '',
        views: viewsMap[it.id?.videoId] || 0,
        idx: i,
      }))
        .filter((t) => t.videoId)
        .filter((t) => !isJunk(t._rawTitle, query, includeSoft))
        .filter((t) => !strictDuration || isReasonableLength(isoToSeconds(t.duration)));

      // Tag verified matches against the iTunes cross-check set, then sort:
      // Topic-channel first (existing behavior), verified real songs next,
      // everything else keeps original relevance order.
      tracks = tracks.map((t) => {
        const key = `${t.artist.toLowerCase().replace(/[^a-z0-9]/g, '')}|${normTitle(t.title)}`;
        return { ...t, _verified: verifiedSet.has(key) };
      });
      tracks.sort((a, b) =>
        (b._isTopic ? 1 : 0) - (a._isTopic ? 1 : 0) ||
        (b._verified ? 1 : 0) - (a._verified ? 1 : 0) ||
        a._idx - b._idx
      );
      tracks = dedupeTracks(tracks);

      // Songs, not random uploads: if we have enough real songs, hide unverified
      // uploads from tiny channels/low view counts.
      if (mode === 'search') {
        const good = tracks.filter((t) => t._verified || t._isTopic);
        if (good.length >= 5) {
          tracks = tracks.filter((t) => t._verified || t._isTopic || (t._views || 0) >= 500000);
        }
      }
    }

    tracks = tracks.map((t) => ({ ...stripInternal(t), verified: !!t._verified }));

    let artist = null;
    if (mode === 'artistSongs') {
      try {
        const chres = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}&key=${apiKey}`);
        const chdata = await chres.json();
        const ch = chdata.items?.[0];
        if (ch) {
          artist = {
            title: decodeHtml(ch.snippet?.title),
            thumbnail: ch.snippet?.thumbnails?.medium?.url || ch.snippet?.thumbnails?.default?.url || '',
            subscribers: ch.statistics?.subscriberCount || 0,
          };
        }
      } catch {}
    }

    return res.status(200).json({ tracks, artist, nextPageToken: data.nextPageToken || '' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}


// ---------------------------------------------------------------------------
// Public handler: input validation, result cache, per-IP rate limit.
// Cache hits cost no YouTube quota and don't count toward the rate limit.
// ---------------------------------------------------------------------------
const resultCache = makeCache({ ttlMs: 10 * 60 * 1000, max: 400 });
const CACHEABLE = new Set(['search', 'artists', 'artistSongs', 'trending']);

export default async function handler(req, res) {
  const body = parseBody(req);
  const mode = body.mode || 'search';
  const query = String(body.query || '').trim();
  const channelId = String(body.channelId || '');
  const pageToken = String(body.pageToken || '');

  if (query.length > 100) return res.status(400).json({ error: 'Query too long', tracks: [], artists: [] });
  if (channelId && !/^UC[\w-]{20,30}$/.test(channelId)) return res.status(400).json({ error: 'Bad channel id', tracks: [], artists: [] });
  if (pageToken && !/^[\w-]{1,200}$/.test(pageToken)) return res.status(400).json({ error: 'Bad page token', tracks: [], artists: [] });

  // ---- SEARCH: free catalogs (Deezer / iTunes). No YouTube quota is spent on searching. ----
  // Playing a result is resolved later by /api/resolve: Audius -> Jamendo -> YouTube.
  if (mode === 'search' && query && !pageToken) {
    const max = Math.min(Number(body.maxResults) || 24, 50);
    const skey = JSON.stringify(['search3', query.toLowerCase(), max]);
    const shit = resultCache.get(skey);
    if (shit) { res.setHeader('X-Cache', 'HIT'); return res.status(200).json(shit); }
    if (!rateLimit(req, res, { name: 'music', max: 40, windowMs: 60 * 1000 })) return undefined;

    let tracks = await searchCatalog(query, max).catch(() => []);
    let diag = { catalog: `${tracks.length} found` };
    if (!tracks.length) {
      // Catalog down or nothing there: fall back to Audius / Jamendo directly.
      try { const f = await searchFree(query, max); tracks = f.tracks; diag = { ...diag, ...f.diag }; } catch (e) { diag.free = 'crashed'; }
    }
    const payload = { tracks, artist: null, nextPageToken: '' };
    if (tracks.length) resultCache.set(skey, payload);
    return res.status(200).json(body.debug ? { ...payload, diag } : payload);
  }

  if (!CACHEABLE.has(mode)) {
    // 'chart' has its own long cache and is cheap; everything else falls through.
    return inner(req, res);
  }

  const key = JSON.stringify([mode, query.toLowerCase(), channelId, pageToken, Number(body.maxResults) || 24]);
  const hit = resultCache.get(key);
  if (hit) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(hit);
  }

  if (!rateLimit(req, res, { name: 'music', max: 40, windowMs: 60 * 1000 })) return undefined;

  let code = 200;
  const origStatus = res.status.bind(res);
  const origJson = res.json.bind(res);
  res.status = (c) => { code = c; return origStatus(c); };
  res.json = (payload) => {
    // Only cache real, non-empty successes (never cache quota errors or empty results).
    const nonEmpty = payload && ((payload.tracks && payload.tracks.length) || (payload.artists && payload.artists.length));
    if (code === 200 && nonEmpty) resultCache.set(key, payload);
    return origJson(payload);
  };
  return inner(req, res);
}
