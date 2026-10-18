// Offline downloads: store audio blobs in IndexedDB so the Android app
// (and the website) can play without network.
// Web download button still also offers a normal file save.

const DB_NAME = 'sarmax-offline';
const DB_VER = 1;
const STORE = 'tracks';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no indexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'videoId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  });
}

/** List all offline tracks (metadata only, no blobs). */
export async function listOffline() {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const rows = (req.result || []).map(({ blob, ...meta }) => meta);
        // newest first
        rows.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        resolve(rows);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function hasOffline(videoId) {
  if (!videoId) return false;
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getKey(videoId);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Return a blob: URL for offline playback, or null. Caller should revoke later. */
export async function getOfflineUrl(videoId) {
  if (!videoId) return null;
  try {
    const db = await openDb();
    const row = await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(videoId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (!row || !row.blob) return null;
    return URL.createObjectURL(row.blob);
  } catch {
    return null;
  }
}

export async function getOfflineMeta(videoId) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(videoId);
      req.onsuccess = () => {
        const r = req.result;
        if (!r) return resolve(null);
        const { blob, ...meta } = r;
        resolve(meta);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Save a track for offline. blob must be a Blob/File.
 * Overwrites if already present.
 */
export async function saveOffline(track, blob) {
  if (!track?.videoId || !blob || blob.size < 1024) {
    throw new Error('invalid track or empty audio');
  }
  const db = await openDb();
  const row = {
    videoId: track.videoId,
    title: track.title || '',
    artist: track.artist || '',
    thumbnail: track.thumbnail || '',
    duration: track.duration || '',
    size: blob.size,
    mime: blob.type || 'audio/mpeg',
    savedAt: Date.now(),
    blob,
  };
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(row);
  await txDone(tx);
  return { videoId: row.videoId, title: row.title, artist: row.artist, thumbnail: row.thumbnail, duration: row.duration, size: row.size, savedAt: row.savedAt };
}

export async function removeOffline(videoId) {
  if (!videoId) return;
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(videoId);
  await txDone(tx);
}

/** Trigger a normal browser/file download (website behaviour). */
export function downloadFileToDevice(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || 'track.mp3';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}

export function formatBytes(n) {
  if (!n || n < 1024) return `${n || 0} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
