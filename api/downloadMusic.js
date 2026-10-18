// api/downloadMusic.js
// GET/POST  videoId | url
// ?stream=1  → pipes audio (no full buffer → avoids Vercel ~4.5MB limit)
//
// Env:
//   REALMUSIC_API_URL  (default https://cobalt-tools-production-0cd6.up.railway.app)
//   REALMUSIC_API_KEY  (optional)

import { rateLimit, parseBody } from './_guard.js';
import { Readable } from 'stream';

const DEFAULT_API = 'https://cobalt-tools-production-0cd6.up.railway.app';
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function buildYoutubeUrl(idOrUrl) {
  const s = String(idOrUrl || '').trim();
  if (!s) return null;
  if (YT_ID.test(s)) return `https://www.youtube.com/watch?v=${s}`;
  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu') || u.hostname.includes('youtube')) return s;
  } catch {}
  return null;
}

async function callCobalt(youtubeUrl, key, extra = {}) {
  const apiBase = (process.env.REALMUSIC_API_URL || DEFAULT_API).replace(/\/$/, '');
  const payload = {
    url: youtubeUrl,
    downloadMode: 'audio',
    audioFormat: extra.audioFormat || 'mp3',
    audioBitrate: extra.audioBitrate || '128',
    filenameStyle: 'pretty',
    disableMetadata: false,
  };
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (key) headers.Authorization = `Api-Key ${key}`;

  const r = await fetch(`${apiBase}/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000),
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

export default async function handler(req, res) {
  if (!rateLimit(req, res, { name: 'downloadMusic', max: 30, windowMs: 60 * 1000 })) return;

  const key = process.env.REALMUSIC_API_KEY || '';
  const body = parseBody(req);
  const rawUrl =
    body.url ||
    body.videoId ||
    (req.query && (req.query.url || req.query.videoId)) ||
    '';
  const youtubeUrl = buildYoutubeUrl(rawUrl);

  if (!youtubeUrl) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({
      status: 'error',
      error:
        'Provide an 11-char YouTube videoId or youtube URL (not catalog ids like dz_/it_)',
    });
  }

  const wantStream =
    (req.query && String(req.query.stream) === '1') || body.stream === true;

  try {
    const { ok, status, data } = await callCobalt(youtubeUrl, key, body);
    if (!ok || !data || data.status === 'error') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(status >= 400 ? status : 502).json({
        status: 'error',
        error:
          (data && data.error && (data.error.code || data.error)) ||
          `Upstream ${status}`,
      });
    }

    let fileUrl = null;
    let filename = data.filename || 'track.mp3';
    if ((data.status === 'tunnel' || data.status === 'redirect') && data.url) {
      fileUrl = data.url;
    } else if (data.status === 'local-processing' && data.tunnel && data.tunnel[0]) {
      fileUrl = data.tunnel[0];
      if (data.output && data.output.filename) filename = data.output.filename;
    }

    if (!fileUrl) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ status: 'error', error: 'no file url from cobalt' });
    }

    if (!wantStream) {
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json({ ...data, url: fileUrl, filename });
    }

    // Pipe upstream — avoid buffering entire file into memory
    const fr = await fetch(fileUrl, { signal: AbortSignal.timeout(55000) });
    if (!fr.ok || !fr.body) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ status: 'error', error: `file ${fr.status}` });
    }

    const ct = fr.headers.get('content-type') || 'audio/mpeg';
    const cl = fr.headers.get('content-length');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', ct);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${String(filename).replace(/"/g, '')}"`
    );
    if (cl) res.setHeader('Content-Length', cl);

    const nodeStream = Readable.fromWeb(fr.body);
    nodeStream.on('error', () => {
      try {
        res.end();
      } catch {}
    });
    nodeStream.pipe(res);
    return undefined;
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    if (!res.headersSent) {
      return res.status(504).json({
        status: 'error',
        error:
          e.name === 'TimeoutError' || e.name === 'AbortError'
            ? 'timeout'
            : String(e.message || 'network'),
      });
    }
    try {
      res.end();
    } catch {}
    return undefined;
  }
}
