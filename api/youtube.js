// api/youtube.js — GET /api/youtube            -> trending videos
//                  GET /api/youtube?q=lofi     -> search
// Returns { videos: [{ id, title, channel, thumbnail, duration }] }.
// Uses the YOUTUBE_API_KEY you already have. Results are cached for 30 minutes
// (search costs 100 quota units, so this protects your daily quota).
import { rateLimit, makeCache } from './_guard.js';

const cache = makeCache({ ttlMs: 30 * 60 * 1000, max: 500 });
const ID = /^[A-Za-z0-9_-]{11}$/;

async function getJson(url, ms = 7000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

function shape(items) {
  return (items || [])
    .filter((v) => v && ID.test(v.id || '') && (!v.status || v.status.embeddable !== false))
    .map((v) => {
      const s = v.snippet || {};
      const th = s.thumbnails || {};
      const pic = (th.medium || th.high || th.default || {}).url || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
      return {
        id: v.id,
        title: String(s.title || '').slice(0, 200),
        channel: String(s.channelTitle || '').slice(0, 100),
        thumbnail: pic,
        duration: (v.contentDetails && v.contentDetails.duration) || '',
      };
    });
}

export default async function handler(req, res) {
  if (!rateLimit(req, res, { name: 'youtube', max: 40, windowMs: 60 * 1000 })) return;
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(503).json({ error: 'Not configured', videos: [] });

  const q = String((req.query && req.query.q) || '').trim().slice(0, 100);
  const cacheKey = q.toLowerCase();
  const hit = cache.get(cacheKey);
  const send = (videos) => {
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({ videos });
  };
  if (hit) return send(hit);

  let ids = [];
  if (q) {
    const s = await getJson(
      `https://www.googleapis.com/youtube/v3/search?part=id&type=video&videoEmbeddable=true&safeSearch=moderate&maxResults=24&q=${encodeURIComponent(q)}&key=${key}`
    );
    ids = ((s && s.items) || []).map((i) => i && i.id && i.id.videoId).filter((x) => ID.test(x || ''));
    if (!ids.length) return send([]);
  }

  const url = q
    ? `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${ids.join(',')}&key=${key}`
    : `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&chart=mostPopular&regionCode=US&maxResults=30&key=${key}`;
  const d = await getJson(url);
  if (!d) return res.status(502).json({ error: 'Unavailable', videos: [] });

  const videos = shape(d.items);
  cache.set(cacheKey, videos);
  return send(videos);
}
