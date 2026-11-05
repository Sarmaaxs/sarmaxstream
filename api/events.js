// api/events.js: POST { events: [...] } from the player. Stores anonymous listening events.
// Each event: { user_key, media_id, media_type, event, duration_consumed, total_duration, value, meta }
// event is one of: complete | skip | repeat | playlist_add | volume. At most 50 per request.
import { rateLimit, parseBody } from './_guard.js';
import { sb, sbReady } from './_sb.js';

const EVENTS = new Set(['complete', 'skip', 'repeat', 'playlist_add', 'volume']);
const TYPES = new Set(['music', 'movie', 'book']);
const KEY = /^[A-Za-z0-9_-]{16,64}$/;
const secs = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(86400, Math.round(n))) : 0;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
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
