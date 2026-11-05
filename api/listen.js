// api/listen.js: one serverless function for both music endpoints
// (Vercel Hobby allows 12 functions per deployment).
//   POST /api/listen                  -> store listening events, body { events: [...] }
//   GET  /api/listen?user=KEY&limit=  -> personal "For You" tracks
import { rateLimit, parseBody } from './_guard.js';
import { sb, sbReady } from './_sb.js';

const EVENTS = new Set(['complete', 'skip', 'repeat', 'playlist_add', 'volume']);
const TYPES = new Set(['music', 'movie', 'book']);
const KEY = /^[A-Za-z0-9_-]{16,64}$/;
const HALF_LIFE_DAYS = 14;

const secs = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(86400, Math.round(n))) : 0;
};

// Music signals: a finished track is the strongest positive, an early skip is negative.
export function eventWeight(e) {
  switch (e.event) {
    case 'complete': return 3;
    case 'repeat': return 3;
    case 'playlist_add': return 4;
    case 'skip': return (Number(e.duration_consumed) || 0) < 10 ? -2 : -0.5;
    case 'volume': return (Number(e.value) || 0) >= 0.8 ? 0.5 : 0; // weak signal
    default: return 0;
  }
}

export function scoreTracks(events, now = Date.now()) {
  const by = new Map();
  for (const e of events) {
    const t = Date.parse(e.created_at);
    if (!Number.isFinite(t)) continue;
    const ageDays = Math.max(0, (now - t) / 86400000);
    const w = eventWeight(e) * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    const cur = by.get(e.media_id) || { media_id: e.media_id, score: 0, meta: null, last: 0 };
    cur.score += w;
    if (e.meta && t >= cur.last) { cur.meta = e.meta; cur.last = t; }
    by.set(e.media_id, cur);
  }
  return [...by.values()]
    .filter((x) => x.score > 0 && x.meta)
    .sort((a, b) => b.score - a.score);
}

async function saveEvents(req, res) {
  if (!rateLimit(req, res, { name: 'events', max: 30, windowMs: 60 * 1000 })) return undefined;

  const body = parseBody(req);
  const list = Array.isArray(body.events) ? body.events.slice(0, 50) : [];
  const rows = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const user_key = String(e.user_key || '');
    const media_id = String(e.media_id || '').slice(0, 80);
    const event = String(e.event || '');
    if (!KEY.test(user_key) || !media_id || !EVENTS.has(event)) continue;
    const m = e.meta && typeof e.meta === 'object' ? e.meta : null;
    const v = Number(e.value);
    rows.push({
      user_key,
      media_id,
      media_type: TYPES.has(e.media_type) ? e.media_type : 'music',
      event,
      duration_consumed: secs(e.duration_consumed),
      total_duration: secs(e.total_duration),
      value: Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null,
      meta: m && {
        title: String(m.title || '').slice(0, 160),
        artist: String(m.artist || '').slice(0, 120),
        thumbnail: String(m.thumbnail || '').slice(0, 300),
        duration: String(m.duration || '').slice(0, 20),
      },
    });
  }

  if (!rows.length) return res.status(204).end();
  if (!sbReady()) return res.status(503).json({ error: 'Storage not configured' });
  await sb('music_events', { method: 'POST', body: rows, prefer: 'return=minimal' });
  return res.status(204).end();
}

async function forYou(req, res) {
  const q = req.query || {};
  const user = String(q.user || '');
  const limit = Math.max(1, Math.min(50, parseInt(q.limit, 10) || 20));
  if (!KEY.test(user)) return res.status(400).json({ error: 'Bad user key', tracks: [] });
  if (!rateLimit(req, res, { name: 'recommend', max: 30, windowMs: 60 * 1000 })) return undefined;

  res.setHeader('Cache-Control', 'private, no-store');
  if (!sbReady()) return res.status(200).json({ tracks: [] });

  const rows = await sb(
    `music_events?user_key=eq.${encodeURIComponent(user)}&media_type=eq.music` +
    `&order=created_at.desc&limit=500&select=media_id,event,duration_consumed,total_duration,value,meta,created_at`
  );
  const ranked = scoreTracks(Array.isArray(rows) ? rows : []).slice(0, limit);
  return res.status(200).json({
    tracks: ranked.map(({ media_id, meta }) => ({
      videoId: media_id,
      title: meta.title,
      artist: meta.artist,
      thumbnail: meta.thumbnail,
      duration: meta.duration,
      source: 'history',
      verified: false,
    })),
  });
}

export default async function handler(req, res) {
  if (req.method === 'POST') return saveEvents(req, res);
  if (req.method === 'GET') return forYou(req, res);
  return res.status(405).json({ error: 'GET or POST only' });
}
