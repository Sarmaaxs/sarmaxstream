// api/stream.js — GET /api/stream?id=aud_XXXX | jam_12345
// Redirects the <audio> element to the real stream, so API keys stay on the server.
import { rateLimit, makeCache } from './_guard.js';

const cache = makeCache({ ttlMs: 10 * 60 * 1000, max: 500 });

async function getJson(url, ms = 6000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

export default async function handler(req, res) {
  const id = String((req.query && req.query.id) || '');
  const aud = /^aud_([A-Za-z0-9]{1,24})$/.exec(id);
  const jam = /^jam_(\d{1,10})$/.exec(id);
  if (!aud && !jam) return res.status(400).json({ error: 'Bad id' });
  if (!rateLimit(req, res, { name: 'stream', max: 120, windowMs: 60 * 1000 })) return undefined;

  let target = cache.get(id);
  if (!target) {
    if (aud) {
      // Audius streaming is public; the key is optional.
      const key = process.env.AUDIUS_API_KEY;
      target = `https://api.audius.co/v1/tracks/${aud[1]}/stream?app_name=sarmaxstream${key ? `&api_key=${encodeURIComponent(key)}` : ''}`;
    } else {
      const cid = process.env.JAMENDO_CLIENT_ID;
      if (!cid) return res.status(500).json({ error: 'Jamendo not configured' });
      const data = await getJson(`https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(cid)}&format=json&id=${jam[1]}&audioformat=mp31`);
      target = data && data.results && data.results[0] && data.results[0].audio;
      if (!target) return res.status(404).json({ error: 'Track not found' });
    }
    cache.set(id, target);
  }
  if (req.query && req.query.debug && process.env.HEALTH_KEY && req.query.debug === process.env.HEALTH_KEY) {
    try {
      const r = await fetch(target, { redirect: 'manual' });
      let loc = r.headers.get('location') || '';
      try { loc = new URL(loc).host; } catch {}
      return res.status(200).json({ id, status: r.status, redirectsTo: loc, contentType: r.headers.get('content-type') || '' });
    } catch (e) {
      return res.status(200).json({ id, error: e.message });
    }
  }
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.statusCode = 302;
  res.setHeader('Location', target);
  return res.end();
}
