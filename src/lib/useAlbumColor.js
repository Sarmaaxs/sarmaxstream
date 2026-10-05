import { useEffect, useState } from 'react';

// Picks one rich colour from a cover image, so the lyrics screen and the mini player
// can match the song (red cover -> red background, like Spotify).
// If the image host doesn't allow reading pixels, we fall back to a colour made from the song name,
// so every song still gets its own colour.

const cache = new Map();

const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;

function fromSeed(seed) {
  let h = 0;
  const str = String(seed || 'sarmax');
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return hsl(Math.abs(h) % 360, 52, 30);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

function extract(img) {
  const N = 24;
  const c = document.createElement('canvas');
  c.width = N; c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, N, N);
  const d = ctx.getImageData(0, 0, N, N).data; // throws if the image is "tainted"
  const buckets = Array.from({ length: 12 }, () => ({ w: 0, hs: 0, ss: 0 }));
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    const vivid = (s / 100) * (1 - Math.abs(2 * (l / 100) - 1)); // colourful and not too dark/light
    if (vivid < 0.05) continue;
    const sh = (h + 15) % 360;
    const b = buckets[Math.floor(sh / 30)];
    b.w += vivid; b.hs += sh * vivid; b.ss += s * vivid;
  }
  let best = null;
  for (const b of buckets) if (!best || b.w > best.w) best = b;
  if (!best || best.w < 0.4) return hsl(225, 10, 22); // black & white cover: calm neutral
  const h = (best.hs / best.w - 15 + 360) % 360;
  const s = Math.max(42, Math.min(78, best.ss / best.w));
  return hsl(h, s, 30);
}

export function useAlbumColor(url, seed = '') {
  const [color, setColor] = useState(() => (url && cache.get(url)) || fromSeed(seed));

  useEffect(() => {
    if (!url) { setColor(fromSeed(seed)); return undefined; }
    if (cache.has(url)) { setColor(cache.get(url)); return undefined; }
    let alive = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let c;
      try { c = extract(img); } catch { c = fromSeed(seed); }
      cache.set(url, c);
      if (alive) setColor(c);
    };
    img.onerror = () => { if (alive) setColor(fromSeed(seed)); };
    img.src = url;
    return () => { alive = false; };
  }, [url, seed]);

  return color;
}
