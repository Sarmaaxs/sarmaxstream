import { cachedJson } from '@/lib/cache';
// Reading list + progress, stored in the browser (works without an account).
const SAVED_KEY = 'sarmax_books_saved';
const PROGRESS_KEY = 'sarmax_books_progress';
const PREFS_KEY = 'sarmax_reader_prefs';

function read(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

export const getSaved = () => read(SAVED_KEY, []);
export function toggleSavedBook(book) {
  const list = getSaved();
  const exists = list.some((b) => b.id === book.id);
  const next = exists ? list.filter((b) => b.id !== book.id) : [{ id: book.id, title: book.title, author: book.author, cover: book.cover }, ...list];
  write(SAVED_KEY, next.slice(0, 200));
  return !exists;
}
export const isSavedBook = (id) => getSaved().some((b) => b.id === id);

// progress: { [id]: { page, total, title, author, cover, at } }
export const getAllProgress = () => read(PROGRESS_KEY, {});
export const getProgress = (id) => getAllProgress()[id] || null;
export function saveProgress(book, page, total) {
  const all = getAllProgress();
  all[book.id] = { page, total, title: book.title, author: book.author, cover: book.cover, at: Date.now() };
  // keep the 30 most recent
  const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 30);
  write(PROGRESS_KEY, Object.fromEntries(keep));
}
export function continueReading() {
  return Object.entries(getAllProgress())
    .map(([id, v]) => ({ id: Number(id), ...v }))
    .sort((a, b) => b.at - a.at);
}

export const getPrefs = () => ({ fontSize: 16, theme: 'dark', ...read(PREFS_KEY, {}) });
export const setPrefs = (p) => write(PREFS_KEY, p);

// fetch + JSON with automatic retries, so a busy book server never shows an error on the first hiccup.
export async function fetchJsonRetry(url, init, tries = 3, ttlMs = 0) {
  if (ttlMs) {
    try { const d = await cachedJson(url, init, ttlMs); if (d && !d.error) return d; } catch { /* fall through to the retrying path */ }
  }
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, init);
      const data = await r.json();
      if (r.ok && !data.error) return data;
      if (r.status === 400 || r.status === 404) return data; // retrying won't help
      last = data;
    } catch (e) { last = { error: 'Network error' }; }
    if (i < tries - 1) await new Promise((res) => setTimeout(res, 700 * (i + 1)));
  }
  return last || { error: 'The book library is busy right now. Try again in a moment.' };
}
