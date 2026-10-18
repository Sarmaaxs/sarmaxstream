// Shared helpers for the API routes (the leading underscore keeps Vercel from
// exposing this file as its own endpoint).
//
// Note: serverless instances don't share memory, so this is best-effort
// protection. It stops one person hammering the API and cuts repeat YouTube
// calls a lot, which is what protects your daily quota.

const buckets = new Map();

export function clientIp(req) {
  const xf = req.headers && req.headers['x-forwarded-for'];
  const first = (Array.isArray(xf) ? xf[0] : xf || '').split(',')[0].trim();
  return first || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Returns true if the request may continue; otherwise it has already sent a 429.
export function rateLimit(req, res, { name, max, windowMs }) {
  const now = Date.now();
  const key = `${name}:${clientIp(req)}`;
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
  if (b.count > max) {
    res.setHeader('Retry-After', String(Math.ceil((b.reset - now) / 1000)));
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