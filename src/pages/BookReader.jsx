import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2, Heart, Minus, Plus } from 'lucide-react';
import { getPrefs, setPrefs, getProgress, saveProgress, isSavedBook, toggleSavedBook } from '@/lib/books';

const THEMES = {
  dark:  { bg: '#0b0d12', fg: '#e7e7ea', muted: 'rgba(231,231,234,0.5)', bar: 'rgba(255,255,255,0.06)' },
  sepia: { bg: '#f4ecd8', fg: '#3b2f1e', muted: 'rgba(59,47,30,0.55)', bar: 'rgba(59,47,30,0.08)' },
  light: { bg: '#ffffff', fg: '#1a1a1a', muted: 'rgba(26,26,26,0.5)', bar: 'rgba(0,0,0,0.06)' },
};

const PAGE_CHARS = 1500;

// Turn raw Gutenberg text into paragraphs, then group them into pages.
function paginate(text) {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
  const pages = [];
  let cur = [];
  let len = 0;
  for (const p of paras) {
    if (len + p.length > PAGE_CHARS && cur.length) { pages.push(cur); cur = []; len = 0; }
    if (p.length > PAGE_CHARS * 1.6) {
      // very long paragraph: split at sentence boundaries
      const sentences = p.match(/[^.!?]+[.!?]+["”’']?\s*|.+$/g) || [p];
      let chunk = '';
      for (const s of sentences) {
        if (chunk.length + s.length > PAGE_CHARS && chunk) { pages.push([chunk.trim()]); chunk = ''; }
        chunk += s;
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
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [truncated, setTruncated] = useState(false);
  const [prefs, setPrefsState] = useState(getPrefs());
  const [saved, setSaved] = useState(false);
  const scrollRef = useRef(null);
  const touch = useRef(null);
  const theme = THEMES[prefs.theme] || THEMES.dark;

  useEffect(() => {
    let active = true;
    setStatus('loading');
    (async () => {
      try {
        const [meta, txt] = await Promise.all([
          fetch('/api/searchBooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'get', id }) }).then((r) => r.json()).catch(() => ({})),
          fetch(`/api/bookText?id=${encodeURIComponent(id)}`).then((r) => r.json()),
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

  // Save the reading position (and jump to the top of the new page).
  useEffect(() => {
    if (status !== 'ready' || !book) return;
    saveProgress(book, page, pages.length);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [page, status, book, pages.length]);

  const go = useCallback((d) => setPage((p) => Math.max(0, Math.min(pages.length - 1, p + d))), [pages.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const updatePrefs = (patch) => { const n = { ...prefs, ...patch }; setPrefsState(n); setPrefs(n); };
  const content = useMemo(() => pages[page] || [], [pages, page]);
  const pct = pages.length ? Math.round(((page + 1) / pages.length) * 100) : 0;

  const onTouchStart = (e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1);
  };

  const btn = { background: theme.bar, color: theme.fg };

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex flex-col" style={{ height: '100dvh', background: theme.bg, color: theme.fg }}>
      <div className="shrink-0 flex items-center gap-2 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)', paddingBottom: '0.5rem' }}>
        <button aria-label="Back to books" onClick={() => navigate('/books')} className="p-2.5 rounded-full" style={btn}><ArrowLeft size={20} /></button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-sm font-semibold truncate">{book ? book.title : 'Loading…'}</div>
          {book && book.author && <div className="text-xs truncate" style={{ color: theme.muted }}>{book.author}</div>}
        </div>
        <button aria-label="Smaller text" onClick={() => updatePrefs({ size: Math.max(14, prefs.size - 1) })} className="p-2.5 rounded-full" style={btn}><Minus size={16} /></button>
        <button aria-label="Larger text" onClick={() => updatePrefs({ size: Math.min(30, prefs.size + 1) })} className="p-2.5 rounded-full" style={btn}><Plus size={16} /></button>
        {book && (
          <button aria-label="Save for later" onClick={() => setSaved(toggleSavedBook(book))} className="p-2.5 rounded-full" style={{ ...btn, color: saved ? '#e5484d' : theme.fg }}>
            <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      <div ref={scrollRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5">
        <div className="mx-auto max-w-2xl py-4" style={{ fontSize: `${prefs.size}px`, lineHeight: 1.7, fontFamily: 'Georgia, "Times New Roman", serif' }}>
          {status === 'loading' && <div className="flex items-center justify-center gap-2 py-24" style={{ color: theme.muted }}><Loader2 className="animate-spin" size={18} /> Opening book…</div>}
          {status === 'error' && (
            <div className="py-24 text-center" style={{ color: theme.muted, fontFamily: 'system-ui, sans-serif', fontSize: 15 }}>
              Couldn't open this book. It may be unavailable or too large.
              <div className="mt-4"><button onClick={() => navigate('/books')} className="px-4 py-2 rounded-full" style={btn}>Back to books</button></div>
            </div>
          )}
          {status === 'ready' && content.map((p, i) => <p key={i} style={{ margin: '0 0 1em', textAlign: 'left' }}>{p}</p>)}
          {status === 'ready' && truncated && page === pages.length - 1 && (
            <p style={{ color: theme.muted, fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>This is a very long book, so only the first part is shown here.</p>
          )}
        </div>
      </div>

      {status === 'ready' && (
        <div className="shrink-0 px-3 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
          <div className="flex items-center gap-3 mx-auto max-w-2xl">
            <button aria-label="Previous page" onClick={() => go(-1)} disabled={page === 0} className="p-3 rounded-full disabled:opacity-30" style={btn}><ChevronLeft size={22} /></button>
            <div className="flex-1 min-w-0">
              <input type="range" min={0} max={Math.max(0, pages.length - 1)} value={page} onChange={(e) => setPage(Number(e.target.value))} aria-label="Book position" className="w-full h-8" />
              <div className="flex justify-between text-[11px] tabular-nums" style={{ color: theme.muted }}>
                <span>Page {page + 1} of {pages.length}</span><span>{pct}%</span>
              </div>
            </div>
            <button aria-label="Next page" onClick={() => go(1)} disabled={page >= pages.length - 1} className="p-3 rounded-full disabled:opacity-30" style={btn}><ChevronRight size={22} /></button>
          </div>
          <div className="flex justify-center gap-2 mt-2">
            {Object.keys(THEMES).map((k) => (
              <button key={k} onClick={() => updatePrefs({ theme: k })} aria-label={`${k} theme`} className="w-7 h-7 rounded-full border-2" style={{ background: THEMES[k].bg, borderColor: prefs.theme === k ? '#e5484d' : 'rgba(128,128,128,0.4)' }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
