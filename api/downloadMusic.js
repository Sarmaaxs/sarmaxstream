// api/downloadMusic.js
// GET/POST  videoId | url
// ?stream=1  → pipes audio; rejects empty upstream bodies as 502
//
// Env:
//   REALMUSIC_API_URL  (default https://cobalt-tools-production-0cd6.up.railway.app)
//   REALMUSIC_API_KEY  (optional)

import { rateLimit, parseBody } from './_guard.js';

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

/** Write a web ReadableStream to the Node response, after verifying the first chunk is non-empty. */
async function pipeBody(fr, res, { contentType, filename }) {
  if (!fr.body || typeof fr.body.getReader !== 'function') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ status: 'error', error: 'no upstream body' });
  }

  const reader = fr.body.getReader();
  const first = await reader.read();
  if (first.done || !first.value || first.value.length === 0) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      status: 'error',
      error: 'cobalt returned an empty file (YouTube may be blocking this instance)',
    });
  }

  const ct = contentType || fr.headers.get('content-type') || 'audio/mpeg';
  const cl = fr.headers.get('content-length');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', ct);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${String(filename || 'track.mp3').replace(/"/g, '')}"`
  );
  if (cl) res.setHeader('Content-Length', cl);

  res.write(Buffer.from(first.value));
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.length) {
      const ok = res.write(Buffer.from(value));
      if (!ok) await new Promise((r) => res.once('drain', r));
    }
  }
  res.end();
  return undefined;
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

    const fr = await fetch(fileUrl, { signal: AbortSignal.timeout(55000) });
    if (!fr.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ status: 'error', error: `file ${fr.status}` });
    }

    return await pipeBody(fr, res, {
      contentType: fr.headers.get('content-type') || 'audio/mpeg',
      filename,
    });
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
