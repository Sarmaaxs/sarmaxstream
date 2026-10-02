import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2, Heart, Minus, Plus } from 'lucide-react';
import { getPrefs, setPrefs, getProgress, saveProgress, isSavedBook, toggleSavedBook, fetchJsonRetry } from '@/lib/books';
import { idbGet, idbSet } from '@/lib/cache';

const THEMES = {
  dark:  { bg: '#0a0a0c', text: '#dcd8d0', muted: '#8a8780', paper: '#17171a', back: '#101012', edge: ['#1d1d21', '#26262b', '#303036'] },
  sepia: { bg: '#2b2118', text: '#3b2f2f', muted: '#8a7660', paper: '#f4ead2', back: '#e9dcbc', edge: ['#e8dcc0', '#d8c9a6', '#c7b58c'] },
  light: { bg: '#d9d9d6', text: '#1d1d1d', muted: '#77777a', paper: '#fdfdfb', back: '#efefea', edge: ['#ececea', '#dcdcd8', '#cbcbc6'] },
};

const HEAD_RE = /^(chapter|book|part|volume|act|scene|section|canto|prologue|epilogue|preface|contents|introduction|letter|stave)\b/i;

// text -> paragraphs [{ text, kind: 'head' | 'p', off }]
function toParas(text) {
  const out = [];
  const re = /\S[\s\S]*?(?=\n\s*\n|$)/g;
  const src = text.replace(/\r\n/g, '\n');
  let m;
  while ((m = re.exec(src))) {
    const t = m[0].replace(/\s*\n\s*/g, ' ').trim();
    if (!t) continue;
    const head = t.length <= 60 && (HEAD_RE.test(t) || (t === t.toUpperCase() && /[A-Z]{3}/.test(t) && t.length <= 50));
    out.push({ text: t, kind: head ? 'head' : 'p', off: m.index });
  }
  return out;
}

// Fill fixed-size pages by line budget, splitting long paragraphs at word boundaries.
function paginate(paras, lines, cpl) {
  const pages = [];
  let segs = [];
  let used = 0;
  const flush = () => { if (segs.length) { pages.push({ segs, off: segs[0].off }); segs = []; used = 0; } };
  for (const p of paras) {
    if (p.kind === 'head') {
      const need = Math.ceil(p.text.length / cpl) + 2;
      if (used + need > lines) flush();
      segs.push({ text: p.text, kind: 'head', off: p.off });
      used += need;
      continue;
    }
    let rest = p.text;
    let off = p.off;
    let cont = false;
    while (rest.length) {
      let room = lines - used;
      if (room < 2) { flush(); room = lines; }
      const cap = Math.floor(room * cpl);
      let take = rest;
      if (rest.length > cap) {
        const cut = rest.lastIndexOf(' ', cap);
        take = rest.slice(0, cut > cap * 0.5 ? cut : cap);
      }
      segs.push({ text: take.trim(), kind: 'p', off, cont });
      used += Math.ceil(take.length / cpl);
      off += take.length + 1;
      rest = rest.slice(take.length).trimStart();
      cont = true;
      if (rest.length) flush();
    }
  }
  flush();
  return pages;
}

// How many lines / characters-per-line fit, measured with the real font in the real width.
function measure(textW, textH, fontSize) {
  const lineH = Math.round(fontSize * 1.62);
  const div = document.createElement('div');
  div.lang = 'en';
  div.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;width:${textW}px;font:${fontSize}px/${lineH}px Georgia,"Times New Roman",serif;text-align:justify;hyphens:auto;`;
  const sample = 'The old house stood quietly at the end of the lane, and nobody who passed it ever thought to look inside. ';
  let s = '';
  while (s.length < 1600) s += sample;
  div.textContent = s;
  document.body.appendChild(div);
  const lines = Math.max(1, Math.round(div.getBoundingClientRect().height / lineH));
  document.body.removeChild(div);
  return { lineH, lines: Math.max(4, Math.floor(textH / lineH)), cpl: s.length / lines, textW, textH, fontSize };
}

// Safety net: render pages off-screen and make sure none of them overflows (so no line is ever cut off).
function overflows(pages, g) {
  const box = document.createElement('div');
  box.lang = 'en';
  box.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;width:${g.textW}px;overflow:hidden;font:${g.fontSize}px/${g.lineH}px Georgia,"Times New Roman",serif;text-align:justify;hyphens:auto;`;
  document.body.appendChild(box);
  const step = Math.max(1, Math.floor(pages.length / 160));
  let bad = 0;
  for (let i = 0; i < pages.length; i += step) {
    box.innerHTML = '';
    for (const sg of pages[i].segs) {
      const el = document.createElement(sg.kind === 'head' ? 'div' : 'p');
      el.textContent = sg.text;
      if (sg.kind === 'head') el.style.cssText = `text-align:center;font-variant:small-caps;letter-spacing:0.08em;font-weight:600;margin:${g.lineH}px 0`;
      else el.style.cssText = `margin:0;text-indent:${sg.cont ? 0 : '1.5em'}`;
      box.appendChild(el);
    }
    if (box.getBoundingClientRect().height > g.textH + 0.5) bad += 1;
  }
  document.body.removeChild(box);
  return bad > 0;
}

const Page = React.memo(function Page({ data, num, theme, fontSize, lineH, title, w, h, side }) {
  const pad = { x: 30, top: 38, bottom: 46 };
  return (
    <div
      style={{
        position: 'absolute', inset: 0, width: w, height: h, background: theme.paper, color: theme.text,
        borderRadius: side === 'back' ? '10px 3px 3px 10px' : '3px 10px 10px 3px', overflow: 'hidden',
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {/* paper texture + spine shadow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(to right, rgba(0,0,0,0.22), rgba(0,0,0,0.05) 5%, rgba(0,0,0,0) 12%), linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.04))' }} />
      {data && data.type === 'cover' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 12%' }}>
          {data.cover ? <img src={data.cover} alt="" style={{ width: '46%', maxHeight: '38%', objectFit: 'cover', borderRadius: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', marginBottom: 22 }} /> : null}
          <div style={{ fontSize: Math.round(fontSize * 1.55), fontWeight: 700, lineHeight: 1.2 }}>{data.title}</div>
          <div style={{ width: 48, height: 1, background: theme.muted, margin: '16px 0' }} />
          <div style={{ fontSize: Math.round(fontSize * 0.95), fontStyle: 'italic', color: theme.muted }}>{data.author}</div>
          <div style={{ fontSize: 12, color: theme.muted, marginTop: 28, letterSpacing: '0.12em' }}>SWIPE TO OPEN</div>
        </div>
      )}
      {data && data.type === 'end' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 12%', color: theme.muted }}>
          <div style={{ fontSize: Math.round(fontSize * 1.4), fontStyle: 'italic' }}>The End</div>
          {data.truncated && <div style={{ fontSize: 13, marginTop: 14, fontFamily: 'system-ui, sans-serif' }}>This is a very long book, so only the first part is shown here.</div>}
        </div>
      )}
      {data && data.type === 'text' && (
        <>
          <div style={{ position: 'absolute', top: 14, left: pad.x, right: pad.x, textAlign: 'center', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          <div lang="en" style={{ position: 'absolute', top: pad.top, left: pad.x, right: pad.x, bottom: pad.bottom, overflow: 'hidden', fontSize, lineHeight: `${lineH}px`, textAlign: 'justify', hyphens: 'auto' }}>
            {data.segs.map((s, i) => (s.kind === 'head'
              ? <div key={i} style={{ textAlign: 'center', fontVariant: 'small-caps', letterSpacing: '0.08em', fontWeight: 600, margin: `${lineH}px 0 ${lineH}px` }}>{s.text}</div>
              : <p key={i} style={{ margin: 0, textIndent: s.cont ? 0 : '1.5em' }}>{s.text}</p>))}
          </div>
          <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: theme.muted }}>{num}</div>
        </>
      )}
    </div>
  );
});

const ease = (t) => 1 - Math.pow(1 - t, 3);

export default function BookReader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [rawText, setRawText] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [status, setStatus] = useState('loading');
  const [prefs, setPrefsState] = useState(getPrefs());
  const [saved, setSaved] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [idx, setIdx] = useState(0);
  const [flip, setFlip] = useState(null); // { dir: 'next' | 'prev', p: 0..1 }
  const stageRef = useRef(null);
  const idxRef = useRef(0);
  const flipRef = useRef(null);
  const raf = useRef(0);
  const drag = useRef(null);
  const offRef = useRef(null); // text offset of the page being read (survives re-pagination)
  const theme = THEMES[prefs.theme] || THEMES.dark;
  const fontSize = Math.max(14, Math.min(26, prefs.fontSize || 18));

  // ---------- load (cached in IndexedDB so reopening is instant) ----------
  useEffect(() => {
    let active = true;
    setStatus('loading');
    (async () => {
      try {
        const cacheKey = `book:${id}`;
        const [meta, cached] = await Promise.all([
          fetchJsonRetry('/api/searchBooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'get', id }) }, 2, 24 * 60 * 60 * 1000).catch(() => ({})),
          idbGet(cacheKey),
        ]);
        let txt = cached && Date.now() - cached.t < 30 * 24 * 3600 * 1000 ? cached : null;
        if (!txt) {
          const r = await fetchJsonRetry(`/api/bookText?id=${encodeURIComponent(id)}`, undefined, 3);
          if (r && r.text) { txt = { text: r.text, truncated: !!r.truncated, t: Date.now() }; idbSet(cacheKey, txt); }
        }
        if (!active) return;
        if (!txt) { setStatus('error'); return; }
        const b = (meta && meta.book) || { id: Number(id), title: `Book ${id}`, author: '', cover: '' };
        setBook(b);
        setRawText(txt.text);
        setTruncated(!!txt.truncated);
        const prog = getProgress(Number(id));
        try { const o = localStorage.getItem(`sarmax_book_off_${id}`); offRef.current = o !== null ? Number(o) : null; } catch { offRef.current = null; }
        if (offRef.current === null && prog && prog.total) offRef.current = -prog.page / prog.total; // fallback: ratio
        setSaved(isSavedBook(Number(id)));
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => { active = false; };
  }, [id]);

  // ---------- stage size ----------
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setStage({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [status]);

  const dims = useMemo(() => {
    const w = Math.max(220, Math.min(stage.w - 28, 540));
    const h = Math.max(300, Math.min(stage.h - 20, Math.round(w * 1.5)));
    return { w, h };
  }, [stage]);

  const paras = useMemo(() => (rawText ? toParas(rawText) : []), [rawText]);

  const geo = useMemo(() => {
    if (!stage.w || typeof document === 'undefined') return null;
    return measure(dims.w - 60, dims.h - 84, fontSize);
  }, [dims.w, dims.h, fontSize, stage.w]);

  const pages = useMemo(() => {
    if (!geo || !paras.length) return [];
    let f = 0.97;
    let pg = paginate(paras, geo.lines, geo.cpl * f);
    for (let k = 0; k < 6 && overflows(pg, geo); k++) { f *= 0.96; pg = paginate(paras, geo.lines, geo.cpl * f); }
    return pg;
  }, [geo, paras]);
  const total = pages.length ? pages.length + 2 : 0; // cover + text + end

  // restore position after (re)pagination
  const lastKey = useRef('');
  useEffect(() => {
    if (!pages.length) return;
    const key = `${pages.length}:${fontSize}:${dims.w}x${dims.h}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    let target = 0;
    const o = offRef.current;
    if (o !== null && o < 0) target = Math.max(0, Math.min(total - 1, Math.round(-o * total)));
    else if (o !== null && o > 0) {
      let k = 0;
      for (let i = 0; i < pages.length; i++) { if (pages[i].off <= o) k = i; else break; }
      target = k + 1;
    }
    idxRef.current = target;
    setIdx(target);
  }, [pages, fontSize, dims.w, dims.h, total]);

  const pageData = useCallback((i) => {
    if (i < 0 || i >= total) return null;
    if (i === 0) return { type: 'cover', title: book?.title, author: book?.author, cover: book?.cover };
    if (i === total - 1) return { type: 'end', truncated };
    return { type: 'text', segs: pages[i - 1].segs };
  }, [total, pages, book, truncated]);

  useEffect(() => {
    if (status !== 'ready' || !book || !total) return;
    idxRef.current = idx;
    if (idx > 0 && idx < total - 1) {
      offRef.current = pages[idx - 1].off;
      try { localStorage.setItem(`sarmax_book_off_${id}`, String(pages[idx - 1].off)); } catch { /* ignore */ }
    }
    saveProgress(book, idx, total);
  }, [idx, status, book, total, pages, id]);

  // ---------- page turning ----------
  const setFlipBoth = (f) => { flipRef.current = f; setFlip(f); };

  const finish = useCallback((dir, commit) => {
    const i = idxRef.current + (commit ? (dir === 'next' ? 1 : -1) : 0);
    idxRef.current = i;
    setIdx(i);
    setFlipBoth(null);
  }, []);

  const animateTo = useCallback((dir, from, to, ms) => {
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const dur = Math.max(120, ms * Math.abs(to - from));
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const p = from + (to - from) * ease(k);
      if (k < 1) { setFlipBoth({ dir, p }); raf.current = requestAnimationFrame(step); } else finish(dir, to === 1);
    };
    raf.current = requestAnimationFrame(step);
  }, [finish]);

  const go = useCallback((d) => {
    if (flipRef.current || !total) return;
    const dir = d > 0 ? 'next' : 'prev';
    if ((dir === 'next' && idxRef.current >= total - 1) || (dir === 'prev' && idxRef.current <= 0)) return;
    setFlipBoth({ dir, p: 0 });
    animateTo(dir, 0, 1, 520);
  }, [total, animateTo]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(raf.current); };
  }, [go]);

  const onDown = (e) => {
    if (flipRef.current || !total) return;
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), dir: null, id: e.pointerId, lastX: e.clientX, lastT: performance.now(), v: 0 };
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.dir) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      const dir = dx < 0 ? 'next' : 'prev';
      if ((dir === 'next' && idxRef.current >= total - 1) || (dir === 'prev' && idxRef.current <= 0)) { drag.current = null; return; }
      d.dir = dir;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    const span = dims.w * 0.9;
    const prog = d.dir === 'next' ? -dx / span : dx / span;
    const dt = performance.now() - d.lastT;
    if (dt > 0) d.v = ((e.clientX - d.lastX) / dt) * (d.dir === 'next' ? -1 : 1);
    d.lastX = e.clientX; d.lastT = performance.now();
    setFlipBoth({ dir: d.dir, p: Math.max(0, Math.min(1, prog)) });
  };
  const onUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.dir) {
      // a tap: right side = next, left side = previous
      if (performance.now() - d.t < 400) {
        const r = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        if (x > 0.62) go(1); else if (x < 0.38) go(-1);
      }
      return;
    }
    const f = flipRef.current;
    const p = f ? f.p : 0;
    const commit = p > 0.35 || d.v > 0.5;
    animateTo(d.dir, p, commit ? 1 : 0, 420);
  };
  const onCancel = () => {
    const d = drag.current;
    drag.current = null;
    if (d && d.dir && flipRef.current) animateTo(d.dir, flipRef.current.p, 0, 300);
  };

  const updatePrefs = (patch) => {
    const next = { ...prefs, ...patch };
    setPrefsState(next);
    setPrefs(next);
  };

  const btn = { background: theme.paper, color: theme.text, border: `1px solid ${theme.muted}33` };
  const num = (i) => i; // cover = 0, first text page = 1
  const title = book?.title || '';

  // ---------- what is drawn ----------
  const faceProps = { theme, fontSize, lineH: geo ? geo.lineH : Math.round(fontSize * 1.62), title, w: dims.w, h: dims.h };
  let under = null;
  let leaf = null;
  let q = 0;
  if (total) {
    if (!flip) {
      under = <Page {...faceProps} data={pageData(idx)} num={num(idx)} />;
    } else if (flip.dir === 'next') {
      q = flip.p;
      under = <Page {...faceProps} data={pageData(idx + 1)} num={num(idx + 1)} />;
      leaf = <Page {...faceProps} data={pageData(idx)} num={num(idx)} />;
    } else {
      q = 1 - flip.p;
      under = <Page {...faceProps} data={pageData(idx)} num={num(idx)} />;
      leaf = <Page {...faceProps} data={pageData(idx - 1)} num={num(idx - 1)} />;
    }
  }
  const angle = -180 * q;
  const shade = Math.sin(Math.PI * q);

  return (
    <div className="fixed inset-0 flex flex-col select-none" style={{ background: `radial-gradient(ellipse at center, ${theme.bg}, #000 140%)`, color: theme.text }}>
      <div className="shrink-0 flex items-center gap-2 px-3 py-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
        <button onClick={() => navigate('/books')} className="p-2 rounded-full" style={btn} aria-label="Back"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: '#eee' }}>{book?.title || '…'}</div>
          <div className="text-xs truncate" style={{ color: '#aaa' }}>{book?.author || ''}</div>
        </div>
        <button onClick={() => { if (book) setSaved(toggleSavedBook(book)); }} className="p-2 rounded-full" style={btn} aria-label="Save"><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></button>
        <button onClick={() => updatePrefs({ fontSize: Math.max(14, fontSize - 1) })} className="p-2 rounded-full" style={btn} aria-label="Smaller text"><Minus size={16} /></button>
        <button onClick={() => updatePrefs({ fontSize: Math.min(26, fontSize + 1) })} className="p-2 rounded-full" style={btn} aria-label="Bigger text"><Plus size={16} /></button>
      </div>

      <div
        ref={stageRef}
        className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
      >
        {status === 'loading' && (
          <div className="flex items-center gap-2" style={{ color: '#aaa' }}><Loader2 className="animate-spin" size={18} /> Opening book…</div>
        )}
        {status === 'error' && (
          <div className="text-center px-6" style={{ color: '#bbb', fontSize: 15 }}>
            Couldn't open this book. It may be unavailable or too large.
            <div className="mt-4"><button onClick={() => navigate('/books')} className="px-4 py-2 rounded-full" style={btn}>Back to books</button></div>
          </div>
        )}
        {status === 'ready' && total > 0 && (
          <div style={{ position: 'relative', width: dims.w, height: dims.h, perspective: 2200, perspectiveOrigin: '50% 50%', filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.55))' }}>
            {/* page-block thickness on the right edge */}
            {theme.edge.map((c, i) => (
              <div key={i} style={{ position: 'absolute', top: 2 + i, bottom: -(i + 1), left: 0, right: -(3 * (3 - i)), background: c, borderRadius: '3px 10px 10px 3px' }} />
            ))}
            <div style={{ position: 'absolute', inset: 0 }}>{under}</div>
            {flip && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: '3px 10px 10px 3px', background: 'linear-gradient(to left, rgba(0,0,0,0.5), rgba(0,0,0,0) 70%)', opacity: shade * 0.7 }} />}
            {flip && leaf && (
              <div style={{ position: 'absolute', inset: 0, transformOrigin: 'left center', transformStyle: 'preserve-3d', transform: `rotateY(${angle}deg)` }}>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                  {leaf}
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(to right, rgba(0,0,0,0.0), rgba(0,0,0,0.35))', opacity: q * 0.9 }} />
                </div>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: theme.back, borderRadius: '10px 3px 3px 10px' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(0,0,0,0.25), rgba(0,0,0,0) 30%), repeating-linear-gradient(to bottom, rgba(0,0,0,0.035) 0 2px, rgba(0,0,0,0) 2px 22px)' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', opacity: Math.max(0, 1 - q) * 0.6 }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {status === 'ready' && total > 0 && (
        <div className="shrink-0 px-3 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.6rem)', background: 'rgba(0,0,0,0.25)' }}>
          <div className="flex items-center gap-3 mx-auto max-w-2xl">
            <button aria-label="Previous page" onClick={() => go(-1)} disabled={idx === 0} className="p-3 rounded-full disabled:opacity-30" style={btn}><ChevronLeft size={22} /></button>
            <div className="flex-1 min-w-0">
              <input type="range" min={0} max={Math.max(0, total - 1)} value={idx} onChange={(e) => { if (!flipRef.current) setIdx(Number(e.target.value)); }} aria-label="Book position" className="w-full h-8" />
              <div className="flex justify-between text-[11px] tabular-nums" style={{ color: '#aaa' }}>
                <span>{idx === 0 ? 'Cover' : idx === total - 1 ? 'The End' : `Page ${idx} of ${total - 2}`}</span>
                <span>{Math.round((idx / Math.max(1, total - 1)) * 100)}%</span>
              </div>
            </div>
            <button aria-label="Next page" onClick={() => go(1)} disabled={idx >= total - 1} className="p-3 rounded-full disabled:opacity-30" style={btn}><ChevronRight size={22} /></button>
          </div>
          <div className="flex justify-center gap-2 mt-1">
            {Object.keys(THEMES).map((k) => (
              <button key={k} onClick={() => updatePrefs({ theme: k })} aria-label={`${k} theme`} className="w-6 h-6 rounded-full border-2" style={{ background: THEMES[k].paper, borderColor: prefs.theme === k ? '#e5484d' : 'rgba(128,128,128,0.5)' }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
