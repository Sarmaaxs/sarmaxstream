/* Sarmaxstream service worker: lets the app open and work without internet.
   - App files (/assets/*)  : cache first (they are versioned, never change)
   - Page loads             : network first, falls back to the saved app shell
   - Images / fonts         : saved as you browse, shown instantly next time
   - Some /api GET answers  : network first, saved copy when offline
   Streams, downloads and third-party video players are never touched. */
const V = 'v1';
const SHELL = `sx-shell-${V}`;
const ASSETS = `sx-assets-${V}`;
const IMAGES = `sx-images-${V}`;
const API = `sx-api-${V}`;
const KEEP = [SHELL, ASSETS, IMAGES, API];
const API_OK = /^\/api\/(searchMusic|searchBooks|jikan|health)/;
const MAX_IMAGES = 400;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const shell = await caches.open(SHELL);
      const res = await fetch('/', { cache: 'no-store' });
      if (res.ok) {
        await shell.put('/', res.clone());
        const html = await res.text();
        const urls = Array.from(new Set((html.match(/\/assets\/[^"'\s)]+/g) || [])));
        const assets = await caches.open(ASSETS);
        await Promise.all(urls.map((u) => assets.add(u).catch(() => {})));
      }
    } catch { /* offline during install: fine, it fills as you browse */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => c.delete(k)));
}

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

async function networkFirst(req, cacheName, key, ms) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([fetch(req), timeout(ms)]);
    if (res && res.ok) cache.put(key || req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(key || req);
    if (hit) return hit;
    throw new Error('offline');
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetching = fetch(req).then((res) => {
    // opaque (cross-origin image) responses have status 0 but are still fine to keep
    if (res && (res.ok || res.type === 'opaque')) { cache.put(req, res.clone()); if (max) trim(cacheName, max); }
    return res;
  }).catch(() => null);
  return hit || (await fetching) || Response.error();
}

const OFFLINE_HTML = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#08080a;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><h2>You are offline</h2><p style="opacity:.6">Open the app once with internet and it will work offline next time.</p></div>';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;
  if (req.headers.has('range')) return; // audio / video streaming

  const sameOrigin = url.origin === self.location.origin;

  if (!sameOrigin) {
    // only pictures and fonts from other sites; never video players or API calls
    if (req.destination === 'image') event.respondWith(staleWhileRevalidate(req, IMAGES, MAX_IMAGES));
    else if (req.destination === 'font' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(staleWhileRevalidate(req, ASSETS));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      networkFirst(req, SHELL, '/', 4000).catch(async () => (await caches.match('/')) || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } }))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) { event.respondWith(cacheFirst(req, ASSETS)); return; }
  if (url.pathname === '/sw.js') return;
  if (url.pathname.startsWith('/api/')) {
    if (API_OK.test(url.pathname)) event.respondWith(networkFirst(req, API, null, 6000));
    return;
  }
  event.respondWith(staleWhileRevalidate(req, ASSETS));
});
