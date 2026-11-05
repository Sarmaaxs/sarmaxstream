// api/recommend.js: GET /api/recommend?user=KEY&limit=20
// Scores one listener's own history and returns their top tracks.
// Each event counts for more or less, and older events fade (half-life 14 days).
import { rateLimit } from './_guard.js';
import { sb, sbReady } from './_sb.js';

const KEY = /^[A-Za-z0-9_-]{16,64}$/;
const HALF_LIFE_DAYS = 14;

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

export default async function handler(req, res) {
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
