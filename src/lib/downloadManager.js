// src/lib/downloadManager.js
// One place that runs downloads, tracks progress and saves the result.
// UI reads it through useDownloads() / useDownloadJob().
import { useSyncExternalStore } from 'react';
import { saveOffline, hasOffline } from '@/lib/offlineDownloads';
import { isNative } from '@/lib/native';
import { downloadYoutubeOnDevice, deviceDownloadAvailable } from '@/lib/ytDevice';

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const isAudioId = (id) => typeof id === 'string' && (id.startsWith('aud_') || id.startsWith('jam_'));

/* ------------------------------ store ------------------------------ */
let jobs = [];
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getSnapshot = () => jobs;
const emit = () => {
  jobs = jobs.slice();
  listeners.forEach((f) => f());
};
const TOAST_MS = 2200;
const patch = (key, p) => {
  jobs = jobs.map((j) => (j.key === key ? { ...j, ...p } : j));
  listeners.forEach((f) => f());
};

export const useDownloads = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
export const useDownloadJob = (videoId) => {
  const all = useDownloads();
  return all.find((j) => j.videoId === videoId) || null;
};
export const dismissDownload = (key) => {
  jobs = jobs.filter((j) => j.key !== key);
  emit();
};
export const retryDownload = (key) => {
  const j = jobs.find((x) => x.key === key);
  if (j) startDownload(j.track);
};
const autoClear = (key, ms) =>
  setTimeout(() => {
    const j = jobs.find((x) => x.key === key);
    if (j && j.status === 'done') dismissDownload(key);
  }, ms);

/* ----------------------------- helpers ----------------------------- */
function safeFilename(title, artist) {
  const base =
    [artist, title].filter(Boolean).join(' - ').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'track';
  return base.slice(0, 120);
}

function extFor(blob) {
  const t = (blob.type || '').toLowerCase();
  if (t.includes('mpeg') || t.includes('mp3')) return '.mp3';
  if (t.includes('mp4') || t.includes('aac') || t.includes('m4a')) return '.m4a';
  if (t.includes('webm')) return '.webm';
  if (t.includes('ogg') || t.includes('opus')) return '.ogg';
  return '.mp3';
}

function forceSaveBlob(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch {}
      try { a.remove(); } catch {}
    }, 2500);
  } catch {}
}

/** Resolve a track to a downloadable source: { kind: 'free'|'yt', id } or null. */
async function resolveDownloadableId(track, opts = {}) {
  const id = track.videoId || track.catalogId || '';
  if (!opts.skipFree && isAudioId(id)) return { kind: 'free', id };
  if (!opts.forceResolve && YT_ID.test(id)) return { kind: 'yt', id };

  const qs = new URLSearchParams({ artist: track.artist || '', title: track.title || '' });
  const dur = Number(track.duration);
  if (dur > 0) qs.set('dur', String(Math.round(dur)));
  if (opts.skipFree) qs.set('skip', 'free');

  const res = await fetch(`/api/resolve?${qs}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!res || !res.videoId) return null;
  if (isAudioId(res.videoId)) return { kind: 'free', id: res.videoId };
  if (YT_ID.test(res.videoId)) return { kind: 'yt', id: res.videoId };
  return null;
}

const urlFor = (src) =>
  src.kind === 'free'
    ? `/api/stream?id=${encodeURIComponent(src.id)}&proxy=1`
    : `/api/downloadMusic?videoId=${encodeURIComponent(src.id)}&stream=1`;

/** Download one source with live progress. Throws a descriptive error. */
async function fetchAudioBlob(src, onProgress) {
  let res;
  try {
    res = await fetch(urlFor(src));
  } catch (e) {
    throw new Error(`${src.kind}: network error`);
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j && (j.detail || j.error)) msg = String(j.detail || j.error);
    } catch {}
    throw new Error(`${src.kind}: ${msg}`);
  }
  const total = Number(res.headers.get('content-length')) || 0;
  const ctHeader = (res.headers.get('content-type') || '').toLowerCase();

  let blob;
  if (res.body && res.body.getReader) {
    const reader = res.body.getReader();
    const parts = [];
    let loaded = 0;
    let last = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        loaded += value.length;
        const now = Date.now();
        if (now - last > 120) {
          last = now;
          onProgress && onProgress(loaded, total);
        }
      }
    } catch (e) {
      throw new Error(`${src.kind}: connection dropped at ${loaded} bytes`);
    }
    onProgress && onProgress(loaded, total);
    if (total && loaded < total) throw new Error(`${src.kind}: cut short (${loaded}/${total} bytes)`);
    blob = new Blob(parts, { type: ctHeader });
  } else {
    blob = await res.blob();
    onProgress && onProgress(blob.size, blob.size);
  }

  const ct = (blob.type || ctHeader).toLowerCase();
  if (blob.size < 1024 || ct.includes('json') || ct.includes('html') || ct.startsWith('text/')) {
    let hint = '';
    try { hint = (await blob.text()).slice(0, 100); } catch {}
    throw new Error(`${src.kind}: empty/invalid file (${blob.size}B) ${hint}`);
  }
  return blob;
}

function friendly(raw) {
  const m = String(raw || '');
  if (/youtube\.login|LOGIN_REQUIRED|sign in to confirm/i.test(m))
    return 'YouTube is blocking the download server (login required).';
  if (/empty file|empty\/invalid/i.test(m)) return 'The download server returned an empty file.';
  if (/no YouTube match|no source/i.test(m)) return 'No downloadable source found for this song.';
  if (/dropped|cut short|network/i.test(m)) return 'Connection dropped while downloading.';
  return 'Download failed.';
}

/* ------------------------------ runner ----------------------------- */
async function run(track, key) {
  const errors = [];
  const progress = (loaded, total) => patch(key, { status: 'downloading', loaded, total });

  try {
    if (isNative && (await hasOffline(track.videoId).catch(() => false))) {
      patch(key, { status: 'done', toastUntil: Date.now() + TOAST_MS, message: 'Already saved — play it from Downloads' });
      autoClear(key, 4000);
      return;
    }

    const first = await resolveDownloadableId(track).catch(() => null);
    let free = first && first.kind === 'free' ? first : null;
    let ytId = first && first.kind === 'yt' ? first.id : null;

    // the track is itself a YouTube id: still look for a free (Audius/Jamendo) copy first
    if (!free && YT_ID.test(track.videoId || '')) {
      const r = await resolveDownloadableId(track, { forceResolve: true }).catch(() => null);
      if (r && r.kind === 'free') free = r;
    }

    let blob = null;
    let via = '';

    // 1) free library
    if (free) {
      patch(key, { status: 'downloading', source: 'free', message: 'Free music library', loaded: 0, total: 0 });
      try { blob = await fetchAudioBlob(free, progress); via = 'free'; } catch (e) { errors.push(e.message); }
    }

    if (!blob && !ytId) {
      const alt = await resolveDownloadableId(track, { skipFree: true, forceResolve: true }).catch(() => null);
      if (alt && alt.kind === 'yt') ytId = alt.id;
      else errors.push('no YouTube match found');
    }

    // 2) our download server
    if (!blob && ytId) {
      patch(key, { status: 'downloading', source: 'server', message: 'Download server', loaded: 0, total: 0 });
      try { blob = await fetchAudioBlob({ kind: 'yt', id: ytId }, progress); via = 'server'; }
      catch (e) { errors.push(e.message); }
    }

    // 3) Android app: the phone itself
    if (!blob && ytId && isNative && deviceDownloadAvailable()) {
      patch(key, { status: 'downloading', source: 'phone', message: 'Your phone', loaded: 0, total: 0 });
      try { blob = await downloadYoutubeOnDevice(ytId); via = 'phone'; }
      catch (e) { errors.push(`phone: ${e.message || e}`); }
    }

    if (!blob) throw new Error(errors.join(' | ') || 'no source found for this song');

    patch(key, { status: 'saving', message: 'Saving…', loaded: blob.size, total: blob.size });

    if (isNative) {
      await saveOffline(track, blob); // the app WebView cannot write files: keep it in the app
    } else {
      forceSaveBlob(blob, safeFilename(track.title, track.artist) + extFor(blob));
      try { await saveOffline(track, blob); } catch {}
    }

    patch(key, {
      status: 'done',
      toastUntil: Date.now() + TOAST_MS,
      via,
      size: blob.size,
      message: isNative ? 'Saved — play it from Downloads' : 'Downloaded',
    });
    autoClear(key, 6000);
  } catch (e) {
    console.warn('Download failed', e, errors);
    patch(key, { status: 'error', toastUntil: Date.now() + 3500, message: friendly(e && e.message), error: String((e && e.message) || e).slice(0, 300) });
  }
}

export function startDownload(track) {
  if (!track || !track.videoId) return null;
  const key = track.videoId;
  const existing = jobs.find((j) => j.key === key);
  if (existing && existing.status !== 'error' && existing.status !== 'done') return existing;

  const job = {
    key,
    videoId: track.videoId,
    title: track.title || 'Unknown',
    artist: track.artist || '',
    thumbnail: track.thumbnail || '',
    track,
    status: 'resolving',
    message: 'Finding the best source…',
    source: '',
    loaded: 0,
    total: 0,
    startedAt: Date.now(),
    toastUntil: Date.now() + TOAST_MS,
  };
  jobs = jobs.filter((j) => j.key !== key).concat(job);
  emit();
  run(track, key);
  return job;
}
