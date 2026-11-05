// src/lib/telemetry.js
// Anonymous listening events, sent in batches. Never blocks or slows playback.
const KEY_NAME = 'sx_user_key';
let queue = [];
let timer = null;

// Random id kept on this device. It is not tied to an account.
export function userKey() {
  try {
    let k = localStorage.getItem(KEY_NAME);
    if (!k || !/^[A-Za-z0-9_-]{16,64}$/.test(k)) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      k = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(KEY_NAME, k);
    }
    return k;
  } catch {
    return null;
  }
}

export const mediaKey = (t) => (t && (t.catalogId || t.videoId)) || '';

export const metaOf = (t) => ({
  title: (t && t.title) || '',
  artist: (t && t.artist) || '',
  thumbnail: (t && t.thumbnail) || '',
  duration: (t && t.duration) || '',
});

function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length) return;
  const body = JSON.stringify({ events: queue.splice(0, 50) });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }))) return;
  } catch {}
  try {
    fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {}
}

export function logEvent(e) {
  const user_key = userKey();
  if (!user_key || !e || !e.media_id) return;
  queue.push({ user_key, media_type: 'music', ...e });
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(flush, 15000);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}
