// Tiny client cache so the site doesn't re-request the same thing again and again.
//  - cachedJson(): fresh -> instant; a bit old -> instant AND refreshed quietly in the background;
//    network down -> serves the old copy instead of an error.
//  - idbGet / idbSet: IndexedDB for big things (whole books).
const mem = new Map();
const PREFIX = 'sx_c_';
const MAX_BYTES = 250 * 1024;

function readEntry(key) {
  if (mem.has(key)) return mem.get(key);
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const e = JSON.parse(raw);
    mem.set(key, e);
    return e;
  } catch { return null; }
}

function writeEntry(key, value) {
  const e = { t: Date.now(), v: value };
  mem.set(key, e);
  try {
    const s = JSON.stringify(e);
    if (s.length > MAX_BYTES) return;
    localStorage.setItem(PREFIX + key, s);
  } catch {
    // storage full: drop our old entries and try once more
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(PREFIX + key, JSON.stringify(e));
    } catch { /* ignore */ }
  }
}

const worthCaching = (d) => d && !d.error
  && !(Array.isArray(d.tracks) && !d.tracks.length)
  && !(Array.isArray(d.books) && !d.books.length)
  && !(Array.isArray(d.results) && !d.results.length);

export async function cachedJson(url, init, ttlMs = 10 * 60 * 1000) {
  const key = url + '|' + ((init && init.body) || '');
  const hit = readEntry(key);
  const age = hit ? Date.now() - hit.t : Infinity;
  const refresh = async () => {
    const r = await fetch(url, init);
    const data = await r.json();
    if (r.ok && worthCaching(data)) writeEntry(key, data);
    return data;
  };
  if (hit && age < ttlMs) return hit.v;
  if (hit && age < ttlMs * 6) { refresh().catch(() => {}); return hit.v; }
  try {
    return await refresh();
  } catch (e) {
    if (hit) return hit.v;
    throw e;
  }
}

// ---- IndexedDB (books) ----
function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no idb')); return; }
    const req = indexedDB.open('sarmax-cache', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function idbGet(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const r = db.transaction('kv').objectStore('kv').get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    });
  } catch { return null; }
}
export async function idbSet(key, val) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(val, key);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch { /* ignore */ }
}
