// src/lib/ytDevice.js
// On-device YouTube audio download for the Android app (Capacitor native HTTP).
// It runs on the PHONE's own connection, so it is not blocked like a datacenter server.
//
// YouTube changes this often. If downloads stop working, update the CLIENT block below
// (version / user-agent of the YouTube VR app) - nothing else needs to change.

const CLIENT = {
  name: 'ANDROID_VR',
  nameId: '28',
  version: '1.60.19',
  ua: 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
  context: {
    clientName: 'ANDROID_VR',
    clientVersion: '1.60.19',
    deviceMake: 'Oculus',
    deviceModel: 'Quest 3',
    androidSdkVersion: 32,
    osName: 'Android',
    osVersion: '12L',
    hl: 'en',
    timeZone: 'UTC',
    utcOffsetMinutes: 0,
  },
};

const PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const CHUNK = 1024 * 1024; // 1 MiB per request (googlevideo throttles one huge request)

/** Native HTTP (no CORS). Returns null on the website. */
function nativeHttp() {
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  if (!cap) return null;
  if (cap.Plugins && cap.Plugins.CapacitorHttp && typeof cap.Plugins.CapacitorHttp.request === 'function') {
    return cap.Plugins.CapacitorHttp;
  }
  if (typeof cap.nativePromise === 'function') {
    return { request: (o) => cap.nativePromise('CapacitorHttp', 'request', o) };
  }
  return null;
}

export const deviceDownloadAvailable = () => !!nativeHttp();

function b64ToBytes(b64) {
  if (typeof b64 !== 'string') throw new Error('bad chunk (not base64)');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function getPlayer(http, videoId) {
  const r = await http.request({
    url: PLAYER_URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': CLIENT.ua,
      'X-YouTube-Client-Name': CLIENT.nameId,
      'X-YouTube-Client-Version': CLIENT.version,
      Origin: 'https://www.youtube.com',
    },
    data: {
      context: { client: CLIENT.context },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
      playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } },
    },
    responseType: 'json',
    connectTimeout: 15000,
    readTimeout: 20000,
  });
  if (r.status !== 200 || !r.data) throw new Error(`youtube player HTTP ${r.status}`);
  return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
}

/** Best audio-only m4a, then any other audio-only, then the muxed itag 18 as a last resort. */
export function pickFormats(player) {
  const sd = (player && player.streamingData) || {};
  const audio = (sd.adaptiveFormats || []).filter((f) => f && f.url && /^audio\//.test(f.mimeType || ''));
  const byRate = (a, b) => (b.bitrate || 0) - (a.bitrate || 0);
  const m4a = audio.filter((f) => f.mimeType.startsWith('audio/mp4')).sort(byRate);
  const other = audio.filter((f) => !f.mimeType.startsWith('audio/mp4')).sort(byRate);
  const muxed = (sd.formats || []).filter((f) => f && f.url && Number(f.itag) === 18);
  return [m4a[0], other[0], muxed[0]].filter(Boolean);
}

async function downloadFormat(http, f) {
  const total = Number(f.contentLength) || 0;
  if (!total) throw new Error('no content length');
  const parts = [];
  let pos = 0;
  while (pos < total) {
    const end = Math.min(pos + CHUNK - 1, total - 1);
    const sep = f.url.includes('?') ? '&' : '?';
    const r = await http.request({
      url: `${f.url}${sep}range=${pos}-${end}`,
      method: 'GET',
      headers: { 'User-Agent': CLIENT.ua },
      responseType: 'blob',
      connectTimeout: 15000,
      readTimeout: 30000,
    });
    if (r.status !== 200 && r.status !== 206) throw new Error(`googlevideo HTTP ${r.status}`);
    const bytes = b64ToBytes(r.data);
    if (!bytes.length) throw new Error('empty chunk');
    parts.push(bytes);
    pos += bytes.length;
  }
  return new Blob(parts, { type: String(f.mimeType || 'audio/mp4').split(';')[0] });
}

/** Download a YouTube video's audio on the phone. Returns a Blob or throws. */
export async function downloadYoutubeOnDevice(videoId) {
  const http = nativeHttp();
  if (!http) throw new Error('native http not available');

  const player = await getPlayer(http, videoId);
  const ps = player.playabilityStatus || {};
  if (ps.status && ps.status !== 'OK') {
    throw new Error(`youtube: ${ps.status}${ps.reason ? ` (${String(ps.reason).slice(0, 60)})` : ''}`);
  }
  const candidates = pickFormats(player);
  if (!candidates.length) throw new Error('youtube: no downloadable formats (token required)');

  let lastErr = null;
  for (const f of candidates) {
    try {
      const blob = await downloadFormat(http, f);
      if (blob.size >= 1024) return blob;
      lastErr = new Error('tiny file');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('youtube: download failed');
}
