import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2, Heart, Minus, Plus } from 'lucide-react';
import { getPrefs, setPrefs, getProgress, saveProgress, isSavedBook, toggleSavedBook, fetchJsonRetry } from '@/lib/books';

const PAGE_CHARS = 1400;

const THEMES = {
  dark:  { bg: '#0c0c0e', text: '#e8e6e3', muted: '#8a8780', paper: '#141416' },
  sepia: { bg: '#f4ecd8', text: '#3b2f2f', muted: '#7a6a5a', paper: '#faf3e3' },
  light: { bg: '#f7f7f5', text: '#1a1a1a', muted: '#6b6b6b', paper: '#ffffff' },
};

function paginate(text) {
  const paras = text.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
  const pages = [];
  let cur = [];
  let len = 0;
  for (const p of paras) {
    if (len + p.length > PAGE_CHARS && cur.length) { pages.push(cur); cur = []; len = 0; }
    if (p.length > PAGE_CHARS) {
      let chunk = '';
      for (const s of p.split(/(?<=[.!?])\s+/)) {
        if (chunk.length + s.length > PAGE_CHARS && chunk) { pages.push([chunk.trim()]); chunk = ''; }
        chunk += (chunk ? ' ' : '') + s;
      }
      if (chunk.trim()) { cur.push(chunk.trim()); len += chunk.length; }
    } else {
      cur.push(p);
      len += p.length;
    }
  }
  if (cur.length) pages.push(cur);
  return pages;
}

export default function BookReader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [pages, setPages] = useState([]);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('loading');
  const [truncated, setTruncated] = useState(false);
  const [prefs, setPrefsState] = useState(getPrefs());
  const [saved, setSaved] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const touch = useRef(null);
  const theme = THEMES[prefs.theme] || THEMES.dark;

  useEffect(() => {
    let active = true;
    setStatus('loading');
    (async () => {
      try {
        const [meta, txt] = await Promise.all([
          fetchJsonRetry('/api/searchBooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'get', id }) }, 2).catch(() => ({})),
          fetchJsonRetry(`/api/bookText?id=${encodeURIComponent(id)}`, undefined, 3),
        ]);
        if (!active) return;
        if (!txt.text) { setStatus('error'); return; }
        const b = meta.book || { id: Number(id), title: `Book ${id}`, author: '', cover: '' };
        const pgs = paginate(txt.text);
        setBook(b);
        setPages(pgs);
        setTruncated(!!txt.truncated);
        const prog = getProgress(Number(id));
        setPage(prog && prog.page < pgs.length ? prog.page : 0);
        setSaved(isSavedBook(Number(id)));
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (status !== 'ready' || !book) return;
    saveProgress(book, page, pages.length);
  }, [page, status, book, pages.length]);

  const go = useCallback((d) => {
    if (animating) return;
    setPage((p) => Math.max(0, Math.min(pages.length - 1, p + d)));
  }, [pages.length, animating]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const content = useMemo(() => pages[page] || [], [pages, page]);
  const pct = pages.length ? Math.round(((page + 1) / pages.length) * 100) : 0;

  const updatePrefs = (patch) => {
    const next = { ...prefs, ...patch };
    setPrefsState(next);
    setPrefs(next);
  };

  const onTouchStart = (e) => {
    if (animating) return;
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, start: Date.now() };
    setDragX(0);
  };

  const onTouchMove = (e) => {
    if (!touch.current || animating) return;
    const t = e.touches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      setDragX(dx);
    }
  };

  const onTouchEnd = () => {
    if (!touch.current || animating) return;
    const dx = dragX;
    touch.current = null;
    const threshold = 60;

    if (dx < -threshold && page < pages.length - 1) {
      setAnimating(true);
      setDragX(-window.innerWidth);
      setTimeout(() => {
        setPage((p) => p + 1);
        setDragX(0);
        setAnimating(false);
      }, 280);
    } else if (dx > threshold && page > 0) {
      setAnimating(true);
      setDragX(window.innerWidth);
      setTimeout(() => {
        setPage((p) => p - 1);
        setDragX(0);
        setAnimating(false);
      }, 280);
    } else {
      setDragX(0);
    }
  };

  const btn = {
    background: theme.paper,
    color: theme.text,
    border: `1px solid ${theme.muted}33`,
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: theme.bg, color: theme.text }}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-2" style={{ borderBottom: `1px solid ${theme.muted}22` }}>
        <button onClick={() => navigate('/books')} className="p-2 rounded-full" style={btn} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{book?.title || '…'}</div>
          <div className="text-xs truncate" style={{ color: theme.muted }}>{book?.author || ''}</div>
        </div>
        <button
          onClick={() => { if (book) setSaved(toggleSavedBook(book)); }}
          className="p-2 rounded-full"
          style={btn}
          aria-label="Save"
        >
          <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
        <button onClick={() => updatePrefs({ fontSize: Math.max(14, (prefs.fontSize || 18) - 1) })} className="p-2 rounded-full" style={btn}><Minus size={16} /></button>
        <button onClick={() => updatePrefs({ fontSize: Math.min(28, (prefs.fontSize || 18) + 1) })} className="p-2 rounded-full" style={btn}><Plus size={16} /></button>
      </div>

      {/* Page area — swipe like a real book */}
      <div
        className="flex-1 min-h-0 relative overflow-hidden touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="absolute inset-0 px-6 py-8 overflow-y-auto"
          style={{
            background: theme.paper,
            fontSize: prefs.fontSize || 18,
            lineHeight: 1.7,
            fontFamily: 'Georgia, "Times New Roman", serif',
            transform: `translateX(${dragX}px)`,
            transition: animating || dragX === 0 ? 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
            boxShadow: dragX !== 0 ? '0 0 40px rgba(0,0,0,0.25)' : 'none',
          }}
        >
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-24" style={{ color: theme.muted }}>
              <Loader2 className="animate-spin" size={18} /> Opening book…
            </div>
          )}
          {status === 'error' && (
            <div className="py-24 text-center" style={{ color: theme.muted, fontFamily: 'system-ui, sans-serif', fontSize: 15 }}>
              Couldn't open this book. It may be unavailable or too large.
              <div className="mt-4">
                <button onClick={() => navigate('/books')} className="px-4 py-2 rounded-full" style={btn}>Back to books</button>
              </div>
            </div>
          )}
          {status === 'ready' && content.map((p, i) => (
            <p key={i} style={{ margin: '0 0 1.15em', textAlign: 'justify', hyphens: 'auto' }}>{p}</p>
          ))}
          {status === 'ready' && truncated && page === pages.length - 1 && (
            <p style={{ color: theme.muted, fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>
              This is a very long book, so only the first part is shown here.
            </p>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      {status === 'ready' && (
        <div className="shrink-0 px-3 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)', borderTop: `1px solid ${theme.muted}22` }}>
          <div className="flex items-center gap-3 mx-auto max-w-2xl">
            <button aria-label="Previous page" onClick={() => go(-1)} disabled={page === 0} className="p-3 rounded-full disabled:opacity-30" style={btn}>
              <ChevronLeft size={22} />
            </button>
            <div className="flex-1 min-w-0">
              <input
                type="range"
                min={0}
                max={Math.max(0, pages.length - 1)}
                value={page}
                onChange={(e) => setPage(Number(e.target.value))}
                aria-label="Book position"
                className="w-full h-8"
              />
              <div className="flex justify-between text-[11px] tabular-nums" style={{ color: theme.muted }}>
                <span>Page {page + 1} of {pages.length}</span>
                <span>{pct}%</span>
              </div>
            </div>
            <button aria-label="Next page" onClick={() => go(1)} disabled={page >= pages.length - 1} className="p-3 rounded-full disabled:opacity-30" style={btn}>
              <ChevronRight size={22} />
            </button>
          </div>
          <div className="flex justify-center gap-2 mt-2">
            {Object.keys(THEMES).map((k) => (
              <button
                key={k}
                onClick={() => updatePrefs({ theme: k })}
                aria-label={`${k} theme`}
                className="w-7 h-7 rounded-full border-2"
                style={{ background: THEMES[k].bg, borderColor: prefs.theme === k ? '#e5484d' : 'rgba(128,128,128,0.4)' }}
              />
            ))}
          </div>
          <p className="text-center text-[10px] mt-1" style={{ color: theme.muted }}>Swipe left / right to turn pages</p>
        </div>
      )}
    </div>
  );
}
