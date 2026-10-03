// api/tmdb.js — GET /api/tmdb?path=trending/all/week&page=1
// Read-only proxy for movie / TV metadata. The secret stays on the server.
// Needs ONE of these environment variables on Vercel:
//   TMDB_TOKEN    (the long "API Read Access Token")   — preferred
//   TMDB_API_KEY  (the short v3 key)
import { rateLimit, makeCache, parseBody } from './_guard.js';

const cache = makeCache({ ttlMs: 15 * 60 * 1000, max: 600 });

// Only these endpoints can be reached. Anything else is refused.
const ALLOWED = new RegExp(
  '^(' +
    'trending/(all|movie|tv)/(day|week)' +
    '|(movie)/(popular|top_rated|now_playing|upcoming)' +
    '|(tv)/(popular|top_rated|on_the_air|airing_today)' +
    '|discover/(movie|tv)' +
    '|genre/(movie|tv)/list' +
    '|search/(multi|movie|tv)' +
    '|(movie|tv)/\\d{1,9}' +
    '|tv/\\d{1,9}/season/\\d{1,3}' +
  ')$'
);
const APPEND_OK = /^[a-z_,]{1,60}$/;

export default async function handler(req, res) {
  if (!rateLimit(req, res, { name: 'tmdb', max: 120, windowMs: 60 * 1000 })) return;

  const token = process.env.TMDB_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!token && !apiKey) return res.status(503).json({ error: 'Not configured', results: [] });

  const input = parseBody(req);
  const path = String(input.path || '').replace(/^\/+|\/+$/g, '');
  if (!ALLOWED.test(path)) return res.status(400).json({ error: 'Bad request', results: [] });

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (k === 'path' || k === 'api_key' || k === 'include_adult') continue;
    if (!/^[a-z_]{1,30}$/.test(k)) continue;
    const val = String(v).slice(0, 120);
    if (k === 'append_to_response' && !APPEND_OK.test(val)) continue;
    params.set(k, val);
  }
  params.set('include_adult', 'false');
  params.set('language', 'en-US');
  if (!token) params.set('api_key', apiKey);

  const url = `https://api.themoviedb.org/3/${path}?${params.toString()}`;
  const cacheKey = `${path}?${[...params.entries()].filter(([k]) => k !== 'api_key').sort().join('&')}`;
  const hit = cache.get(cacheKey);
  if (hit) {
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json(hit);
  }

  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!r.ok) return res.status(r.status === 404 ? 404 : 502).json({ error: 'Unavailable', results: [] });
    const data = await r.json();
    cache.set(cacheKey, data);
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json(data);
  } catch {
    return res.status(502).json({ error: 'Unavailable', results: [] });
  } finally {
    clearTimeout(t);
  }
}
