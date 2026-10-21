import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Remembers where you were (page + scroll position + the movie/episode you were watching)
// and puts you back there when the app or site is opened again, even hours or days later.
const KEY = 'sx:last-view';
const WATCH_KEY = 'sx:last-watch';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // how long a saved place stays valid
const WATCH_MAX_AGE = 24 * 60 * 60 * 1000;
const SKIP = ['/login', '/register', '/forgot-password', '/reset-password'];

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export default function RouteMemory() {
  const loc = useLocation();
  const navigate = useNavigate();
  const booted = useRef(false);
  const pending = useRef(null); // scroll position to restore after the page has rendered

  // 1) once, when the app starts
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const saved = read(KEY);
    const watch = read(WATCH_KEY);
    const here = loc.pathname + loc.search + loc.hash;
    const bareRoot = loc.pathname === '/' && !loc.search && !loc.hash;
    const watchFresh = watch && Date.now() - watch.t < WATCH_MAX_AGE;
    const watchPath = watchFresh ? `/title/${watch.type}/${watch.id}` : null;
    const resume = watchFresh ? { season: watch.season, episode: watch.episode } : null;

    if (bareRoot && saved && saved.path && Date.now() - saved.t < MAX_AGE && !SKIP.some((p) => saved.path.startsWith(p)) && saved.path !== '/') {
      pending.current = saved.y || 0;
      const savedPathname = saved.path.split(/[?#]/)[0];
      const state = watchPath && savedPathname === watchPath ? { autoplay: true, resume } : undefined;
      navigate(saved.path, { replace: true, state });
    } else if (saved && saved.path === here && saved.y > 0 && Date.now() - saved.t < MAX_AGE && loc.pathname !== '/') {
      pending.current = saved.y; // the Android app reopened this exact page: just restore the scroll
    }
    if (!bareRoot && watchPath && loc.pathname === watchPath && !(history.state && history.state.usr && history.state.usr.autoplay)) {
      // page was reloaded while a movie was playing: reopen the player
      navigate(here, { replace: true, state: { autoplay: true, resume } });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) remember the page every time it changes
  useEffect(() => {
    const path = loc.pathname + loc.search + loc.hash;
    if (SKIP.some((p) => loc.pathname.startsWith(p))) return;
    // don't overwrite the saved place with "/" during the very first render (it is about to be restored)
    const saved = read(KEY);
    if (!booted.current || (pending.current !== null && path === '/' )) return;
    write(KEY, { path, y: saved && saved.path === path ? saved.y || 0 : 0, t: Date.now() });
  }, [loc.pathname, loc.search, loc.hash]);

  // 3) remember the scroll position (cheap: only when you stop scrolling / leave the app)
  useEffect(() => {
    let timer = 0;
    const save = () => {
      if (SKIP.some((p) => window.location.pathname.startsWith(p))) return;
      if (pending.current !== null && window.location.pathname === '/') return;
      write(KEY, { path: window.location.pathname + window.location.search + window.location.hash, y: Math.round(window.scrollY), t: Date.now() });
    };
    const onScroll = () => { clearTimeout(timer); timer = setTimeout(save, 400); };
    const onHide = () => { if (document.visibilityState === 'hidden') save(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  // 4) put the scroll position back once the restored page has content
  useEffect(() => {
    if (pending.current === null || loc.pathname === '/') return undefined;
    const y = pending.current;
    let tries = 0;
    let stopped = false;
    const stop = () => { stopped = true; clearInterval(iv); };
    const iv = setInterval(() => {
      tries += 1;
      if (stopped) return;
      if (y <= 0 || document.documentElement.scrollHeight >= y + window.innerHeight - 40) {
        window.scrollTo(0, y);
        pending.current = null;
        stop();
      } else if (tries > 30) { // ~4.5s: page never got tall enough
        pending.current = null;
        stop();
      }
    }, 150);
    window.addEventListener('touchstart', stop, { once: true, passive: true });
    window.addEventListener('wheel', stop, { once: true, passive: true });
    return () => { stop(); window.removeEventListener('touchstart', stop); window.removeEventListener('wheel', stop); };
  }, [loc.pathname]);

  return null;
}
