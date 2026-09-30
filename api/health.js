// api/health.js — open https://YOUR-SITE/api/health in a browser to see what works.
// Shows which env vars exist (never their values) and live-tests each music source.
import { rateLimit } from './_guard.js';
import { searchAudius, searchJamendo } from './_free.js';

export default async function handler(req, res) {
  if (!rateLimit(req, res, { name: 'health', max: 10, windowMs: 60 * 1000 })) return undefined;
  const env = {
    AUDIUS_API_KEY: !!process.env.AUDIUS_API_KEY,
    JAMENDO_CLIENT_ID: !!process.env.JAMENDO_CLIENT_ID,
    YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
  };
  const q = 'love';
  const [a, j] = await Promise.all([
    searchAudius(q, 5).catch((e) => ({ items: [], why: e.message })),
    searchJamendo(q, 5).catch((e) => ({ items: [], why: e.message })),
  ]);
  let youtube = 'no YOUTUBE_API_KEY';
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${process.env.YOUTUBE_API_KEY}`);
      const d = await r.json();
      youtube = r.ok ? 'ok' : `HTTP ${r.status}: ${(d.error && d.error.message) || 'error'}`;
    } catch (e) { youtube = 'network error'; }
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    env,
    audius: `${a.why} (${a.items.length} found)`,
    jamendo: `${j.why} (${j.items.length} found)`,
    youtube,
  });
}
