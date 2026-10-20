import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Heart, List, Type, Download, Check, X, Minus, Plus } from 'lucide-react';
import {
  getPrefs, setPrefs, getProgress, saveProgress, isSavedBook, toggleSavedBook, fetchJsonRetry,
  isDownloadedBook, markDownloaded, unmarkDownloaded,
} from '@/lib/books';
import { idbGet, idbSet, idbDel } from '@/lib/cache';
import { isNative } from '@/lib/native';

/* ---------------------------------------------------------------------------
   Light-weight reader.
   The old reader measured every paragraph of the whole book in a hidden page
   (hundreds of thousands of layout passes) which froze the browser. This one
   cuts the text into sections once (plain string work, no layout) and only
   ever draws ONE section, so it stays fast even for the longest books.
   Layout follows the usual e-reader conventions (Kindle / Apple Books style):
   a single centred column of ~65 characters, generous line spacing, themes,
   a table of contents, and bars that hide when you tap the page.
--------------------------------------------------------------------------- */

const THEMES = {
  night: { name: 'Night', bg: '#0d0d0f', paper: '#151518', text: '#d9d5cd', muted: '#8b8880', accent: '#d4ff1a', ink: '#0d0d0f', line: 'rgba(255,255,255,0.10)' },
  sepia: { name: 'Sepia', bg: '#e6dcc3', paper: '#f4ecd8', text: '#4b3b2a', muted: '#8a7a63', accent: '#9a5b1f', ink: '#fff', line: 'rgba(75,59,42,0.18)' },
  paper: { name: 'Paper', bg: '#e7e7e3', paper: '#fbfaf7', text: '#1c1c1e', muted: '#76767b', accent: '#2563eb', ink: '#fff', line: 'rgba(0,0,0,0.12)' },
  black: { name: 'Black', bg: '#000000', paper: '#000000', text: '#bdbdbd', muted: '#6c6c6c', accent: '#d4ff1a', ink: '#000', line: 'rgba(255,255,255,0.12)' },
};
const FONTS = {
  serif: { name: 'Serif', css: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif' },
  sans: { name: 'Sans', css: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif' },
};
const WIDTHS = { narrow: 540, normal: 660, wide: 800 };
const LINES = { tight: 1.5, normal: 1.7, loose: 1.95 };

const HEAD_RE = /^(chapter|book|part|volume|act|scene|section|canto|prologue|epilogue|preface|contents|introduction|letter|stave)\b/i;
const SECTION_CHARS = 3200;

// text -> sections [{ off, title, paras: [{ text, head }] }]  (no DOM, one pass)
function buildSections(text) {
  const src = text.replace(/\r\n/g, '\n');
  const sections = [];
  let cur = null;
  const open = (off) => { cur = { off, title: '', paras: [], len: 0 }; sections.push(cur); };

  const handle = (chunk, off) => {
    const t = chunk.replace(/\s*\n\s*/g, ' ').trim();
    if (!t) return;
    const head = t.length <= 60 && (HEAD_RE.test(t) || (t === t.toUpperCase() && /[A-Z]{3}/.test(t) && t.length <= 50));
    if (!cur || (head && cur.len > 600) || cur.len > SECTION_CHARS) open(off);
    if (head) {
      if (!cur.title) cur.title = t;
      else if (cur.len < 160 && cur.title.length < 80) cur.title += ' — ' + t; // "CHAPTER I" + "Down the Rabbit-Hole"
    }
    cur.paras.push({ text: t, head });
    cur.len += t.length;
  };

  const re = /\n[ \t]*\n+/g;
  let last = 0;
  let m;
  while ((m = re.exec(src))) { handle(src.slice(last, m.index), last); last = m.index + m[0].length; }
  handle(src.slice(last), last);

  const toc = [];
  sections.forEach((s, i) => { if (s.title && toc.length < 400) toc.push({ i, title: s.title }); });
  return { sections, toc };
}

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export default function BookReader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [rawText, setRawText] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [status, setStatus] = useState('loading');
  const [prefs, setPrefsState] = useState(() => getPrefs());
  const [saved, setSaved] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const [bars, setBars] = useState(true);
  const [panel, setPanel] = useState(null); // 'toc' | 'settings' | null
  const scrollRef = useRef(null);
  const restored = useRef(false);
  const idxRef = useRef(0);
  const pendingScroll = useRef(null);
  const touch = useRef(null);
  const scrollTimer = useRef(0);

  const themeKey = THEMES[prefs.rTheme] ? prefs.rTheme : prefs.theme === 'light' ? 'paper' : 'night';
  const theme = THEMES[themeKey];
  const font = FONTS[prefs.rFont] || FONTS.serif;
  const size = clamp(Number(prefs.rSize) || 19, 14, 32);
  const lineH = LINES[prefs.rLine] || LINES.normal;
  const width = WIDTHS[prefs.rWidth] || WIDTHS.normal;

  // ---------- load (downloaded copy -> cache -> network) ----------
  useEffect(() => {
    let active = true;
    restored.current = false;
    setStatus('loading');
    setIdx(0);
    (async () => {
      try {
        let txt = null;
        let meta = null;
        if (isNative) {
          const d = await idbGet(`bookdl:${id}`);
          if (d && d.text) { txt = { text: d.text, truncated: !!d.truncated }; meta = d.book || null; }
        }
        if (!txt) {
          const cacheKey = `book:${id}`;
          const [m, cached] = await Promise.all([
            fetchJsonRetry('/api/searchBooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'get', id }) }, 2, 24 * 60 * 60 * 1000).catch(() => ({})),
            idbGet(cacheKey),
          ]);
          meta = (m && m.book) || null;
          txt = cached && Date.now() - cached.t < 30 * 24 * 3600 * 1000 ? cached : null;
          if (!txt) {
            const r = await fetchJsonRetry(`/api/bookText?id=${encodeURIComponent(id)}`, undefined, 3);
            if (r && r.text) { txt = { text: r.text, truncated: !!r.truncated, t: Date.now() }; idbSet(cacheKey, txt); }
          }
          if (!txt && cached && cached.text) txt = cached; // offline: an older copy is better than nothing
        }
        if (!active) return;
        if (!txt) { setStatus('error'); return; }
        const p = getProgress(Number(id));
        const b = meta || (p ? { id: Number(id), title: p.title, author: p.author, cover: p.cover } : { id: Number(id), title: `Book ${id}`, author: '', cover: '' });
        setBook(b);
        setRawText(txt.text);
        setTruncated(!!txt.truncated);
        setSaved(isSavedBook(Number(id)));
        setDownloaded(isNative && isDownloadedBook(id));
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => { active = false; };
  }, [id]);

  const { sections, toc } = useMemo(() => (rawText ? buildSections(rawText) : { sections: [], toc: [] }), [rawText]);
  const N = sections.length;

  // ---------- put the reader back where they stopped ----------
  useEffect(() => {
    if (status !== 'ready' || !N || restored.current) return;
    restored.current = true;
    let target = 0;
    let off = null;
    try { const o = localStorage.getItem(`sarmax_book_off_${id}`); if (o !== null) off = Number(o); } catch { /* ignore */ }
    if (off !== null && off > 0) {
      let lo = 0; let hi = N - 1;
      while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (sections[mid].off <= off) lo = mid; else hi = mid - 1; }
      target = lo;
    } else {
      const prog = getProgress(Number(id));
      if (prog && prog.total) target = clamp(Math.round((prog.page / prog.total) * N), 0, N - 1);
    }
    try {
      const sc = JSON.parse(localStorage.getItem(`sarmax_book_scrollf_${id}`) || 'null');
      if (sc && sc.i === target) pendingScroll.current = sc.f;
    } catch { /* ignore */ }
    idxRef.current = target;
    setIdx(target);
    if (target === 0 && pendingScroll.current !== null) {
      // the section did not change, so apply the saved scroll spot ourselves
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el && pendingScroll.current !== null) {
          el.scrollTop = pendingScroll.current * Math.max(0, el.scrollHeight - el.clientHeight);
          pendingScroll.current = null;
        }
      });
    }
  }, [status, N, sections, id]);

  // new section -> scroll to its top (or to the remembered spot once)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pendingScroll.current !== null) {
      el.scrollTop = pendingScroll.current * Math.max(0, el.scrollHeight - el.clientHeight);
      pendingScroll.current = null;
    } else {
      el.scrollTop = 0;
    }
  }, [idx, status]);

  // save progress
  useEffect(() => {
    if (status !== 'ready' || !book || !N || !restored.current) return;
    const sec = sections[idx];
    if (!sec) return;
    idxRef.current = idx;
    try { localStorage.setItem(`sarmax_book_off_${id}`, String(sec.off)); } catch { /* ignore */ }
    saveProgress(book, idx, N);
  }, [idx, status, book, N, sections, id]);

  const onScroll = () => {
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const max = Math.max(1, el.scrollHeight - el.clientHeight);
      try { localStorage.setItem(`sarmax_book_scrollf_${id}`, JSON.stringify({ i: idxRef.current, f: el.scrollTop / max })); } catch { /* ignore */ }
    }, 400);
  };
  useEffect(() => () => clearTimeout(scrollTimer.current), []);

  // ---------- moving around ----------
  const go = useCallback((d) => setIdx((i) => clamp(i + d, 0, Math.max(0, N - 1))), [N]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const onTouchStart = (e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) go(dx < 0 ? 1 : -1);
  };

  const onTapText = () => {
    try { if (window.getSelection && String(window.getSelection())) return; } catch { /* ignore */ }
    if (panel) { setPanel(null); return; }
    setBars((b) => !b);
  };

  const updatePrefs = (patch) => {
    const next = { ...prefs, ...patch };
    setPrefsState(next);
    setPrefs(next);
  };

  const toggleDownload = async () => {
    if (!book || dlBusy) return;
    setDlBusy(true);
    try {
      if (downloaded) {
        await idbDel(`bookdl:${id}`);
        unmarkDownloaded(id);
        setDownloaded(false);
      } else {
        await idbSet(`bookdl:${id}`, { text: rawText, truncated, book, t: Date.now() });
        markDownloaded(book);
        setDownloaded(true);
      }
    } finally { setDlBusy(false); }
  };

  const sec = sections[idx];
  const pct = N > 1 ? Math.round((idx / (N - 1)) * 100) : 0;
  const currentChapter = useMemo(() => {
    let t = '';
    for (const c of toc) { if (c.i <= idx) t = c.title; else break; }
    return t;
  }, [toc, idx]);

  const chip = (active) => ({
    background: active ? theme.accent : 'transparent',
    color: active ? theme.ink : theme.text,
    border: `1px solid ${active ? theme.accent : theme.line}`,
  });
  const iconBtn = { color: theme.text, background: 'transparent' };
  const barStyle = { background: theme.paper, color: theme.text, borderColor: theme.line };

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: theme.bg, color: theme.text }}>
      {/* ---------- top bar ---------- */}
      <div
        className="absolute top-0 inset-x-0 z-20 border-b transition-transform duration-200"
        style={{ ...barStyle, transform: bars ? 'none' : 'translateY(-100%)', paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto max-w-5xl h-14 flex items-center gap-1 px-2 sm:px-4">
          <button onClick={() => navigate('/books')} className="p-2.5 rounded-full hover:opacity-70" style={iconBtn} aria-label="Back to books"><ArrowLeft size={20} /></button>
          <div className="flex-1 min-w-0 px-1">
            <div className="text-sm font-semibold truncate">{book?.title || '…'}</div>
            <div className="text-xs truncate" style={{ color: theme.muted }}>{currentChapter || book?.author || ''}</div>
          </div>
          {isNative && status === 'ready' && (
            <button onClick={toggleDownload} disabled={dlBusy} className="p-2.5 rounded-full hover:opacity-70 disabled:opacity-40" style={iconBtn} aria-label={downloaded ? 'Remove download' : 'Download for offline'} title={downloaded ? 'Downloaded (tap to remove)' : 'Download for offline'}>
              {dlBusy ? <Loader2 size={19} className="animate-spin" /> : downloaded ? <Check size={20} style={{ color: theme.accent }} /> : <Download size={20} />}
            </button>
          )}
          <button onClick={() => { if (book) setSaved(toggleSavedBook(book)); }} className="p-2.5 rounded-full hover:opacity-70" style={iconBtn} aria-label="Save for later"><Heart size={20} fill={saved ? 'currentColor' : 'none'} style={saved ? { color: theme.accent } : undefined} /></button>
          <button onClick={() => setPanel(panel === 'toc' ? null : 'toc')} className="p-2.5 rounded-full hover:opacity-70" style={iconBtn} aria-label="Chapters"><List size={20} /></button>
          <button onClick={() => setPanel(panel === 'settings' ? null : 'settings')} className="p-2.5 rounded-full hover:opacity-70" style={iconBtn} aria-label="Reading settings"><Type size={20} /></button>
        </div>
      </div>

      {/* ---------- the text ---------- */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="absolute inset-0 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {status === 'loading' && (
          <div className="h-full flex items-center justify-center gap-2" style={{ color: theme.muted }}><Loader2 className="animate-spin" size={18} /> Opening book…</div>
        )}
        {status === 'error' && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-4" style={{ color: theme.muted }}>
            <div>Couldn't open this book. It may be unavailable, or you are offline and it was not saved.</div>
            <button onClick={() => navigate('/books')} className="px-5 py-2 rounded-full text-sm" style={chip(false)}>Back to books</button>
          </div>
        )}
        {status === 'ready' && sec && (
          <div className="min-h-full md:py-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4.5rem)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 7rem)' }}>
            <article
              onClick={onTapText}
              lang="en"
              className="mx-auto md:rounded-2xl"
              style={{
                maxWidth: width + 96, background: theme.paper, fontFamily: font.css, fontSize: size, lineHeight: lineH,
                padding: 'clamp(1.25rem, 6vw, 3rem)', boxShadow: themeKey === 'black' ? 'none' : '0 10px 40px rgba(0,0,0,0.18)',
                WebkitUserSelect: 'text', userSelect: 'text',
              }}
            >
              {idx === 0 && (
                <header className="text-center pb-8 mb-8 border-b" style={{ borderColor: theme.line }}>
                  {book?.cover && <img src={book.cover} alt="" className="mx-auto w-28 sm:w-32 rounded-md shadow-lg mb-5" style={{ WebkitUserSelect: 'none' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                  <h1 style={{ fontSize: '1.55em', lineHeight: 1.25, fontWeight: 700 }}>{book?.title}</h1>
                  {book?.author && <div style={{ color: theme.muted, marginTop: '0.5em', fontSize: '0.9em' }}>{book.author}</div>}
                </header>
              )}
              {sec.paras.map((p, i) => (p.head
                ? <h2 key={i} style={{ textAlign: 'center', fontWeight: 600, fontSize: '1.2em', letterSpacing: '0.04em', margin: '2em 0 1.2em' }}>{p.text}</h2>
                : <p key={i} style={{ margin: '0 0 0.9em' }}>{p.text}</p>))}

              <div className="mt-10 pt-6 border-t flex items-center justify-between gap-3 text-sm" style={{ borderColor: theme.line, fontFamily: FONTS.sans.css, color: theme.muted }}>
                {idx >= N - 1 ? (
                  <div className="w-full text-center">
                    <div style={{ fontSize: '1.4em', color: theme.text, fontFamily: font.css }}>The End</div>
                    {truncated && <div className="mt-2">This is a very long book, so only the first part is shown here.</div>}
                  </div>
                ) : (
                  <>
                    <span>{pct}% read</span>
                    <button onClick={(e) => { e.stopPropagation(); go(1); }} className="px-5 py-2.5 rounded-full font-semibold" style={{ background: theme.accent, color: theme.ink }}>Continue →</button>
                  </>
                )}
              </div>
            </article>
          </div>
        )}
      </div>

      {/* ---------- bottom bar ---------- */}
      {status === 'ready' && N > 0 && (
        <div
          className="absolute bottom-0 inset-x-0 z-20 border-t transition-transform duration-200"
          style={{ ...barStyle, transform: bars ? 'none' : 'translateY(100%)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="mx-auto max-w-2xl flex items-center gap-2 px-3 py-2">
            <button aria-label="Previous section" onClick={() => go(-1)} disabled={idx === 0} className="p-2.5 rounded-full disabled:opacity-30" style={iconBtn}><ChevronLeft size={22} /></button>
            <div className="flex-1 min-w-0">
              <input
                type="range" min={0} max={Math.max(0, N - 1)} value={idx}
                onChange={(e) => setIdx(Number(e.target.value))}
                aria-label="Position in book"
                className="w-full h-6"
                style={{ accentColor: theme.accent }}
              />
              <div className="flex justify-between text-[11px] tabular-nums" style={{ color: theme.muted }}>
                <span className="truncate pr-3">{currentChapter || `Part ${idx + 1} of ${N}`}</span>
                <span>{pct}%</span>
              </div>
            </div>
            <button aria-label="Next section" onClick={() => go(1)} disabled={idx >= N - 1} className="p-2.5 rounded-full disabled:opacity-30" style={iconBtn}><ChevronRight size={22} /></button>
          </div>
        </div>
      )}

      {/* ---------- settings ---------- */}
      {panel === 'settings' && (
        <div className="absolute z-30 right-2 sm:right-4 w-[min(94vw,22rem)] rounded-2xl border p-4 shadow-2xl space-y-4" style={{ ...barStyle, top: 'calc(env(safe-area-inset-top, 0px) + 3.75rem)' }}>
          <div className="flex items-center justify-between"><div className="text-sm font-semibold">Reading settings</div><button onClick={() => setPanel(null)} aria-label="Close" style={iconBtn}><X size={18} /></button></div>
          <div>
            <div className="text-xs mb-2" style={{ color: theme.muted }}>Page colour</div>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(THEMES).map(([k, t]) => (
                <button key={k} onClick={() => updatePrefs({ rTheme: k })} className="h-11 rounded-xl text-xs font-medium" style={{ background: t.paper, color: t.text, border: `2px solid ${themeKey === k ? theme.accent : t.line}` }}>{t.name}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs mb-2" style={{ color: theme.muted }}>Text size · {size}px</div>
            <div className="flex items-center gap-2">
              <button onClick={() => updatePrefs({ rSize: clamp(size - 1, 14, 32) })} className="h-10 w-12 rounded-xl flex items-center justify-center" style={chip(false)} aria-label="Smaller text"><Minus size={16} /></button>
              <input type="range" min={14} max={32} value={size} onChange={(e) => updatePrefs({ rSize: Number(e.target.value) })} className="flex-1" style={{ accentColor: theme.accent }} aria-label="Text size" />
              <button onClick={() => updatePrefs({ rSize: clamp(size + 1, 14, 32) })} className="h-10 w-12 rounded-xl flex items-center justify-center" style={chip(false)} aria-label="Bigger text"><Plus size={16} /></button>
            </div>
          </div>
          <div>
            <div className="text-xs mb-2" style={{ color: theme.muted }}>Font</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(FONTS).map(([k, f]) => (
                <button key={k} onClick={() => updatePrefs({ rFont: k })} className="h-10 rounded-xl text-sm" style={{ ...chip((prefs.rFont || 'serif') === k), fontFamily: f.css }}>{f.name}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-2" style={{ color: theme.muted }}>Line spacing</div>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.keys(LINES).map((k) => (
                  <button key={k} onClick={() => updatePrefs({ rLine: k })} className="h-9 rounded-lg text-[11px] capitalize" style={chip((prefs.rLine || 'normal') === k)}>{k}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs mb-2" style={{ color: theme.muted }}>Page width</div>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.keys(WIDTHS).map((k) => (
                  <button key={k} onClick={() => updatePrefs({ rWidth: k })} className="h-9 rounded-lg text-[11px] capitalize" style={chip((prefs.rWidth || 'normal') === k)}>{k}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- chapters ---------- */}
      {panel === 'toc' && (
        <>
          <div className="absolute inset-0 z-30 bg-black/50" onClick={() => setPanel(null)} />
          <aside className="absolute z-40 inset-y-0 right-0 w-[min(88vw,24rem)] border-l flex flex-col" style={{ ...barStyle, paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b" style={{ borderColor: theme.line }}>
              <div className="text-sm font-semibold">Chapters</div>
              <button onClick={() => setPanel(null)} aria-label="Close" style={iconBtn}><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain py-1">
              {toc.length === 0 && <div className="p-4 text-sm" style={{ color: theme.muted }}>No chapters found in this book. Use the slider at the bottom.</div>}
              {toc.map((c) => {
                const active = currentChapter === c.title && c.i <= idx;
                return (
                  <button key={c.i} onClick={() => { setIdx(c.i); setPanel(null); }} className="w-full text-left px-4 py-3 text-sm border-b hover:opacity-80" style={{ borderColor: theme.line, color: active ? theme.accent : theme.text, fontWeight: active ? 600 : 400 }}>
                    {c.title}
                  </button>
                );
              })}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
