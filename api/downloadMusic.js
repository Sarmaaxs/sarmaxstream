// api/downloadMusic.js
// GET/POST  videoId | url
// ?stream=1  -> pipes audio to the browser (no full buffering -> no Vercel 4.5MB limit)
// Rejects EMPTY tunnels from Cobalt (502 JSON) and retries with other settings,
// so the client never receives a "200 OK" with a 0-byte file.
//
// Env:
// Cobalt: ALWAYS tries the Railway instance first. REALMUSIC_API_URLS / REALMUSIC_API_URL
// (optional, comma-separated) are only extra backups tried after it.
//   REALMUSIC_API_KEY   (optional)

import { rateLimit, parseBody } from './_guard.js';

const RAILWAY_COBALT = 'https://cobalt-tools-production-0cd6.up.railway.app';
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const MIN_BYTES = 1024;

function buildYoutubeUrl(idOrUrl) {
  const s = String(idOrUrl || '').trim();
  if (!s) return null;
  if (YT_ID.test(s)) return `https://www.youtube.com/watch?v=${s}`;
  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu')) return s;
  } catch {}
  return null;
}

function apiBases() {
  const extra = (process.env.REALMUSIC_API_URLS || process.env.REALMUSIC_API_URL || '')
    .split(',')
    .map((x) => x.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return [RAILWAY_COBALT, ...extra.filter((x) => x !== RAILWAY_COBALT)];
}

async function callCobalt(youtubeUrl, key, opt) {
  const apiBase = opt.base;
  const payload = {
    url: youtubeUrl,
    downloadMode: 'audio',
    audioFormat: opt.audioFormat,
    filenameStyle: 'pretty',
    disableMetadata: false,
  };
  if (opt.audioBitrate) payload.audioBitrate = opt.audioBitrate;
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Api-Key ${key}`;

  const r = await fetch(`${apiBase}/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

function pickFile(data) {
  let fileUrl = null;
  let filename = data.filename || 'track.mp3';
  if ((data.status === 'tunnel' || data.status === 'redirect') && data.url) {
    fileUrl = data.url;
  } else if (data.status === 'local-processing' && data.tunnel && data.tunnel[0]) {
    fileUrl = data.tunnel[0];
    if (data.output && data.output.filename) filename = data.output.filename;
  }
  return { fileUrl, filename };
}

// Ask Cobalt, open the tunnel and make sure real bytes arrive.
// Returns { ok:true, reader, first, ct, filename, data, fileUrl } or { ok:false, error }.
async function openTunnel(youtubeUrl, key, opt, wantStream) {
  let c;
  try {
    c = await callCobalt(youtubeUrl, key, opt);
  } catch (e) {
    return { ok: false, error: e.name === 'TimeoutError' ? 'cobalt timeout' : `cobalt: ${e.message || 'network'}` };
  }
  if (!c.ok || !c.data || c.data.status === 'error') {
    const err = c.data && c.data.error && (c.data.error.code || c.data.error);
    return { ok: false, status: c.status, error: String(err || `cobalt ${c.status}`) };
  }
  const { fileUrl, filename } = pickFile(c.data);
  if (!fileUrl) return { ok: false, error: `no file url from cobalt (status=${c.data.status})` };
  if (!wantStream) return { ok: true, data: c.data, fileUrl, filename };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 25000); // only guards the START of the download
  let fr;
  try {
    fr = await fetch(fileUrl, { signal: ac.signal });
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: `tunnel: ${e.name === 'AbortError' ? 'timeout' : e.message || 'network'}` };
  }
  if (!fr.ok || !fr.body) {
    clearTimeout(timer);
    return { ok: false, error: `tunnel http ${fr.status}` };
  }

  const reader = fr.body.getReader();
  let first;
  try {
    first = await reader.read();
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: `tunnel read: ${e.message || 'failed'}` };
  }
  clearTimeout(timer);
  const n = first && first.value ? first.value.length : 0;
  const declared = Number(fr.headers.get('content-length') || 0);
  // empty tunnel (200 OK with no / tiny body) -> treat as failure so we can retry
  if (first.done || n === 0 || (first.done && n < MIN_BYTES) || (declared > 0 && declared < MIN_BYTES)) {
    try { await reader.cancel(); } catch {}
    return { ok: false, error: 'cobalt returned an empty file' };
  }
  return {
    ok: true,
    reader,
    first: first.value,
    ct: fr.headers.get('content-type') || 'audio/mpeg',
    filename,
    data: c.data,
    fileUrl,
  };
}

export default async function handler(req, res) {
  if (!rateLimit(req, res, { name: 'downloadMusic', max: 30, windowMs: 60 * 1000 })) return undefined;

  const key = process.env.REALMUSIC_API_KEY || '';
  const body = parseBody(req);
  const rawUrl =
    body.url || body.videoId || (req.query && (req.query.url || req.query.videoId)) || '';
  const youtubeUrl = buildYoutubeUrl(rawUrl);

  if (!youtubeUrl) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({
      status: 'error',
      error: 'Provide an 11-char YouTube videoId or youtube URL (not catalog ids like dz_/it_)',
    });
  }

  const wantStream = (req.query && String(req.query.stream) === '1') || body.stream === true;

  // Per instance: mp3 128k, then original audio (no ffmpeg step). Stop before Vercel's 30s limit.
  const formats = [
    { audioFormat: body.audioFormat || 'mp3', audioBitrate: body.audioBitrate || '128' },
    { audioFormat: 'best' },
  ];
  const attempts = apiBases().flatMap((base) => formats.map((f) => ({ ...f, base }))).slice(0, 8);
  const t0 = Date.now();

  let last = { error: 'unknown' };
  const trail = [];
  try {
    for (const opt of attempts) {
      if (Date.now() - t0 > 19000) break;
      const t = await openTunnel(youtubeUrl, key, opt, wantStream);
      if (!t.ok) {
        last = t;
        let host = 'cobalt';
        try { host = new URL(opt.base).hostname.split('.')[0]; } catch {}
        trail.push(`${host}/${opt.audioFormat}: ${t.error}`);
        continue;
      }

      if (!wantStream) {
        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(200).json({ ...t.data, url: t.fileUrl, filename: t.filename });
      }

      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Type', t.ct);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${String(t.filename).replace(/"/g, '')}"`
      );
      res.statusCode = 200;
      res.write(Buffer.from(t.first));
      try {
        for (;;) {
          const { done, value } = await t.reader.read();
          if (done) break;
          if (!res.write(Buffer.from(value))) {
            await new Promise((r) => res.once('drain', r));
          }
        }
      } catch {
        /* upstream broke mid-way: end what we have */
      }
      res.end();
      return undefined;
    }
  } catch (e) {
    last = { error: String((e && e.message) || 'network') };
  }

  res.setHeader('Cache-Control', 'no-store');
  if (res.headersSent) {
    try { res.end(); } catch {}
    return undefined;
  }
  return res.status(502).json({ status: 'error', error: last.error || 'download failed', detail: trail.join(' ; ') });
}
