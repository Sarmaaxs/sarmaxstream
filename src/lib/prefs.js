// Site-wide preferences (appearance, content, privacy). Lives outside React context
// so it applies on every page and BEFORE the first paint (see applyPrefs() in main.jsx).
import { useSyncExternalStore } from 'react';

const KEY = 'sarmax_prefs_v1';

export const ACCENTS = {
  lime:    { label: 'Lime',    primary: '72 100% 55%',  fg: '240 10% 3.5%' },
  violet:  { label: 'Violet',  primary: '262 90% 68%',  fg: '0 0% 100%' },
  sky:     { label: 'Sky',     primary: '199 95% 58%',  fg: '240 10% 3.5%' },
  rose:    { label: 'Rose',    primary: '346 90% 62%',  fg: '0 0% 100%' },
  orange:  { label: 'Orange',  primary: '24 96% 58%',   fg: '240 10% 3.5%' },
  emerald: { label: 'Emerald', primary: '152 70% 48%',  fg: '240 10% 3.5%' },
};

export const LANGUAGES = [
  { value: 'en-US', label: 'English' },
  { value: 'es-ES', label: 'Español' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'pt-BR', label: 'Português (BR)' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'ar-SA', label: 'العربية' },
  { value: 'tr-TR', label: 'Türkçe' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'hi-IN', label: 'हिन्दी' },
];

export const DEFAULTS = {
  accent: 'lime',
  textSize: 'default',        // small | default | large
  motion: 'system',           // system | reduce | full
  contentLanguage: 'en-US',   // sent to TMDB as ?language=
  saveSearchHistory: true,
  shortcuts: true,            // keyboard shortcuts in the music player
  saveToPhone: true,          // Android app: also save downloaded songs as real files
  appLock: false,             // Android app: ask for fingerprint / screen lock when opening
};

let state = read();
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getPrefs() { return state; }

export function applyPrefs(p = state) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const a = ACCENTS[p.accent] || ACCENTS.lime;
  root.style.setProperty('--primary', a.primary);
  root.style.setProperty('--ring', a.primary);
  root.style.setProperty('--sidebar-primary', a.primary);
  root.style.setProperty('--primary-foreground', a.fg);
  root.style.setProperty('--sidebar-primary-foreground', a.fg);
  root.style.fontSize = p.textSize === 'small' ? '15px' : p.textSize === 'large' ? '18px' : '';
  root.classList.toggle('reduce-motion', p.motion === 'reduce');
  root.classList.toggle('full-motion', p.motion === 'full');
}

export function setPref(key, value) {
  state = { ...state, [key]: value };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full / blocked */ }
  applyPrefs(state);
  listeners.forEach((l) => l());
}

export function resetPrefs() {
  state = { ...DEFAULTS };
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  applyPrefs(state);
  listeners.forEach((l) => l());
}

function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }

export function usePrefs() {
  return useSyncExternalStore(subscribe, getPrefs, getPrefs);
}

// ---------- data controls ----------
const SEARCH_KEY = 'sarmax_recent_searches';

export function clearSearchHistory() {
  try { localStorage.removeItem(SEARCH_KEY); } catch { /* ignore */ }
}

export function clearRecentlyPlayed() {
  try { localStorage.removeItem('sarmax_recent'); } catch { /* ignore */ }
}

// Cached API answers (movies, anime, music lookups). Safe to wipe; they refill on demand.
export function clearCachedData() {
  let n = 0;
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sx_c_') || k.startsWith('anilist:'))
      .forEach((k) => { localStorage.removeItem(k); n++; });
  } catch { /* ignore */ }
  try { indexedDB.deleteDatabase('sarmax-cache'); } catch { /* ignore */ }
  return n;
}

// Everything this app keeps on this device, minus caches, as a downloadable JSON file.
export function exportLocalData() {
  const out = {};
  try {
    Object.keys(localStorage)
      .filter((k) => !k.startsWith('sx_c_') && !k.startsWith('anilist:') && !/^sb-|supabase/i.test(k))
      .forEach((k) => {
        const v = localStorage.getItem(k);
        try { out[k] = JSON.parse(v); } catch { out[k] = v; }
      });
  } catch { /* ignore */ }
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: out }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sarmaxstream-my-data.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Wipe every preference and local record this app owns (keeps the sign-in session).
export function resetEverythingLocal() {
  try {
    Object.keys(localStorage)
      .filter((k) => /^(sarmax|sx_c_|anilist:)/.test(k) || k.startsWith('sarmaxstream:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  try { indexedDB.deleteDatabase('sarmax-cache'); } catch { /* ignore */ }
  resetPrefs();
}
