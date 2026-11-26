// Persistent music downloads for offline playback/storage inside the app.
// IndexedDB stores Blob objects without converting large audio files to base64.
const DB_NAME = 'sarmax-offline-music';
const DB_VERSION = 1;
const STORE = 'tracks';

let dbPromise;
const objectUrls = new Map();

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Offline storage is unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'videoId' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error('Could not open offline storage'));
    request.onblocked = () => reject(new Error('Offline storage upgrade is blocked'));
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Offline storage request failed'));
  });
}

export async function hasOffline(videoId) {
  if (typeof videoId !== 'string' || !videoId) return false;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const record = await requestResult(tx.objectStore(STORE).get(videoId));
    return !!(record && record.blob instanceof Blob && record.blob.size > 0);
  } catch {
    return false;
  }
}

export async function saveOffline(track, blob) {
  const videoId = track && track.videoId;
  if (typeof videoId !== 'string' || !videoId || !(blob instanceof Blob) || blob.size === 0) return false;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      videoId,
      title: String(track.title || 'Unknown').slice(0, 200),
      artist: String(track.artist || '').slice(0, 200),
      thumbnail: String(track.thumbnail || '').slice(0, 1000),
      duration: Number.isFinite(Number(track.duration)) ? Number(track.duration) : 0,
      blob,
      savedAt: Date.now(),
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Could not save offline track'));
      tx.onabort = () => reject(tx.error || new Error('Offline save was cancelled'));
    });
    return true;
  } catch {
    // A quota/private-browsing failure should not turn a successful download
    // into a failed one; the normal file-save path can still complete.
    return false;
  }
}

export async function listOffline() {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const rows = await requestResult(tx.objectStore(STORE).getAll());
    return rows
      .filter((row) => row && row.blob instanceof Blob && row.blob.size > 0)
      .map(({ videoId, title, artist, thumbnail, duration, savedAt, blob }) => ({
        videoId, title, artist, thumbnail, duration, savedAt, size: blob.size,
      }))
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function getOfflineTrack(videoId) {
  if (typeof videoId !== 'string' || !videoId) return null;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const row = await requestResult(tx.objectStore(STORE).get(videoId));
    return row && row.blob instanceof Blob ? row : null;
  } catch {
    return null;
  }
}


export async function getOfflineUrl(videoId) {
  if (typeof videoId !== 'string' || !videoId || typeof URL === 'undefined' || !URL.createObjectURL) return null;
  if (objectUrls.has(videoId)) return objectUrls.get(videoId);
  const row = await getOfflineTrack(videoId);
  if (!row || !(row.blob instanceof Blob)) return null;
  const url = URL.createObjectURL(row.blob);
  objectUrls.set(videoId, url);
  return url;
}

export async function removeOffline(videoId, { revokeUrl = true } = {}) {
  if (typeof videoId !== 'string' || !videoId) return false;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(videoId);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Could not remove offline track'));
      tx.onabort = () => reject(tx.error || new Error('Offline removal was cancelled'));
    });
    const url = objectUrls.get(videoId);
    if (url && revokeUrl) {
      try { URL.revokeObjectURL(url); } catch {}
      objectUrls.delete(videoId);
    }
    return true;
  } catch {
    return false;
  }
}
