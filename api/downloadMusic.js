// api/downloadMusic.js
// POST /api/downloadMusic  { url | videoId, title?, artist? }
// GET  /api/downloadMusic?url=... | ?videoId=...
//
// Proxies to https://api.cobalt.tools (Cobalt-style) so the Api-Key stays
// on the server. Returns a short-lived tunnel/redirect URL the browser can
// fetch as a blob for download. Optimized for audio (mp3).
//
// Env: REALMUSIC_API_KEY  (required) — Authorization: Api-Key <key>
// Optional: REALMUSIC_API_URL  (default https://api.cobalt.tools)

import { rateLimit, parseBody } from './_guard.js';

const DEFAULT_API = 'https://api.cobalt.tools';
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function buildYoutubeUrl(idOrUrl) {
  const s = String(idOrUrl || '').trim();
  if (!s) return null;
  if (YT_ID.test(s)) return `https://www.youtube.com/watch?v=${s}`;
  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu')) return s;
  } catch {}
  // Accept plain id that might have been passed as videoId
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return `https://www.youtube.com/watch?v=${s}`;
  return null;
}

export default async function handler(req, res) {
  if (!rateLimit(req, res, { name: 'downloadMusic', max: 30, windowMs: 60 * 1000 })) return;

  const key = process.env.REALMUSIC_API_KEY;
  if (!key) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'Download service not configured', status: 'error' });
  }

  const body = parseBody(req);
  const rawUrl = body.url || body.videoId || (req.query && (req.query.url || req.query.videoId)) || '';
  const youtubeUrl = buildYoutubeUrl(rawUrl);

  if (!youtubeUrl) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ error: 'Provide a YouTube url or 11-char videoId', status: 'error' });
  }

  const apiBase = (process.env.REALMUSIC_API_URL || DEFAULT_API).replace(/\/$/, '');
  const payload = {
    url: youtubeUrl,
    downloadMode: 'audio',
    audioFormat: body.audioFormat || 'mp3',
    audioBitrate: body.audioBitrate || '128',
    filenameStyle: 'pretty',
    disableMetadata: false,
    alwaysProxy: false,
  };

  // Optional extras from client
  if (body.youtubeBetterAudio) payload.youtubeBetterAudio = true;
  if (body.youtubeDubLang) payload.youtubeDubLang = String(body.youtubeDubLang).slice(0, 5);

  try {
    const r = await fetch(`${apiBase}/`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Api-Key ${key}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    });

    const data = await r.json().catch(() => null);

    if (!r.ok || !data) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json({
        status: 'error',
        error: (data && data.error && data.error.code) || `Upstream ${r.status}`,
        context: data && data.error && data.error.context,
      });
    }

    // Pass through the cobalt-style response so the client can act on tunnel / redirect / error
    res.setHeader('Cache-Control', 'private, no-store'); // tunnel URLs are short-lived
    return res.status(200).json(data);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(504).json({
      status: 'error',
      error: e.name === 'TimeoutError' || e.name === 'AbortError' ? 'timeout' : 'network',
    });
  }
}
