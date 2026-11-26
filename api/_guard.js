// Configure Upstash Redis on Vercel for cross-instance atomic rate limiting.
// Without it, a per-instance memory limiter is retained for local development.
const buckets = new Map();
const REDIS_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  "return {count, redis.call('TTL', KEYS[1])}",
].join('; ');

function headerValue(value) {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}
export function clientIp(req) {
  const real = headerValue(req.headers && req.headers['x-real-ip']).trim();
  if (real) return real;
  const forwarded = headerValue(req.headers && req.headers['x-forwarded-for']).split(',')[0].trim();
  return forwarded || (req.socket && req.socket.remoteAddress) || 'unknown';
}
function localHit(key, max, windowMs, now) {
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.reset) {
    bucket = { count: 0, reset: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (buckets.size > 5000) {
    for (const [k, value] of buckets) if (now >= value.reset) buckets.delete(k);
  }
  return { count: bucket.count, retryAfter: Math.max(1, Math.ceil((bucket.reset - now) / 1000)) };
}
export async function rateLimit(req, res, { name, max, windowMs }) {
  const key = 'sarmaxstream:rl:' + name + ':' + clientIp(req);
  let hit;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl || redisToken) {
    if (!redisUrl || !redisToken) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(503).json({ error: 'Rate limiting is not configured correctly.' });
      return false;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(redisUrl.replace(/\/+$/, '') + '/', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + redisToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(['EVAL', REDIS_SCRIPT, '1', key, String(Math.max(1, Math.ceil(windowMs / 1000)))]),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok || payload.error || !Array.isArray(payload.result)) throw new Error('Redis rate-limit request failed');
      hit = {
        count: Number(payload.result[0]),
        retryAfter: Math.max(1, Number(payload.result[1]) || Math.ceil(windowMs / 1000)),
      };
      if (!Number.isFinite(hit.count)) throw new Error('Redis returned an invalid counter');
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      res.status(503).json({ error: 'Rate limiting is temporarily unavailable.' });
      return false;
    } finally { clearTimeout(timer); }
  } else if (process.env.VERCEL === '1') {
    // A per-instance Map is not a security boundary on serverless platforms.
    // Require a shared store in production rather than silently weakening limits.
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: 'Shared rate limiting is not configured. Set the Upstash Redis REST URL and token.' });
    return false;
  } else {
    hit = localHit(key, max, windowMs, Date.now());
  }
  if (hit.count > max) {
    res.setHeader('Retry-After', String(hit.retryAfter));
    res.setHeader('Cache-Control', 'no-store');
    res.status(429).json({ error: 'Too many requests. Please slow down a little.', tracks: [], artists: [], books: [], lines: [], plain: '' });
    return false;
  }
  return true;
}
export function makeCache({ ttlMs, max }) {
  const m = new Map();
  return {
    get(k) {
      const e = m.get(k);
      if (!e) return null;
      if (Date.now() > e.exp) { m.delete(k); return null; }
      return e.v;
    },
    set(k, v) {
      if (m.size >= max) m.delete(m.keys().next().value);
      m.set(k, { v, exp: Date.now() + ttlMs });
    },
  };
}
export function parseBody(req) {
  if (req.method === 'GET') return req.query || {};
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}
