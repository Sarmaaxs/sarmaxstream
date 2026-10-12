import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

// Nuvessia lyrics: Spotify / Apple Music style.
//  - the line being sung is big, and its words fill with colour from left to right in time
//    with the music (like karaoke / a lyric video)
//  - the lines around it are blurred more the further away they are
//  - instrumental gaps show three breathing dots
//  - tap any line to jump to it
// The fill is painted straight on the DOM every animation frame (no React re-render), so it
// stays smooth even though the player only reports the time 4 times a second.

const SIZES = {
  s: { on: 'text-xl md:text-2xl', off: 'text-lg md:text-xl' },
  m: { on: 'text-2xl md:text-3xl', off: 'text-xl md:text-2xl' },
  l: { on: 'text-3xl md:text-4xl', off: 'text-2xl md:text-3xl' },
};

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const splitWords = (s) => (s || '').split(/\s+/).filter(Boolean);

function lineIndexAt(lines, t) {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= t) idx = i;
    else break;
  }
  return idx;
}

export default function LyricsView({ lines, plain, currentTime, loading, failed, offset = 0, onSeek, isPlaying = false, rate = 1, size = 'm' }) {
  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const wordRefs = useRef([]);
  const userScrollUntil = useRef(0);
  const browseTimer = useRef(0);
  const clock = useRef({ t: 0, at: 0 });
  const paintRef = useRef(() => {});
  const [browsing, setBrowsing] = useState(false);
  const sz = SIZES[size] || SIZES.m;

  const t = (currentTime || 0) + offset;
  const activeIdx = lines && lines.length ? lineIndexAt(lines, t) : -1;

  const startBrowsing = () => {
    userScrollUntil.current = Date.now() + 4000;
    setBrowsing(true);
    clearTimeout(browseTimer.current);
    browseTimer.current = setTimeout(() => setBrowsing(false), 4000);
  };
  useEffect(() => () => clearTimeout(browseTimer.current), []);

  // Smooth scroll so the active line sits in the middle.
  useEffect(() => {
    if (activeIdx < 0) return;
    if (Date.now() < userScrollUntil.current) return;
    const box = containerRef.current;
    const el = lineRefs.current[activeIdx];
    if (!box || !el) return;
    const target = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [activeIdx, browsing, size]);

  useEffect(() => { lineRefs.current = []; }, [lines]);

  // ---- karaoke fill -------------------------------------------------------------------
  // Works out how far through the current line we are and sets --f (0..1) on every word.
  paintRef.current = (now) => {
    if (!lines || !lines.length) return;
    const time = now + offset;
    const i = lineIndexAt(lines, time);
    if (i < 0 || i !== activeIdx) return; // React hasn't caught up with a line change yet
    const els = wordRefs.current;
    if (!els.length) return;
    const line = lines[i];
    const nxt = lines[i + 1];
    const gap = nxt ? nxt.time - line.time : 8;
    const parts = splitWords(line.text);
    const total = parts.reduce((s, w) => s + w.length + 1, 0) || 1;
    // sing the line over roughly its length, but never longer than the gap to the next line
    const dur = Math.max(0.6, Math.min(gap * 0.9, Math.max(1.4, total * 0.075 + 0.4)));
    const p = clamp01((time - line.time) / dur);
    let acc = 0;
    for (let k = 0; k < parts.length; k++) {
      const len = parts[k].length + 1;
      const f = clamp01((p * total - acc) / len);
      acc += len;
      if (els[k]) els[k].style.setProperty('--f', f.toFixed(3));
    }
  };

  // keep a clock that we can extrapolate between the player's 250ms updates
  useEffect(() => { clock.current = { t: currentTime || 0, at: performance.now() }; }, [currentTime]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    let raf = 0;
    clock.current = { t: clock.current.t, at: performance.now() };
    const tick = () => {
      const c = clock.current;
      const now = c.t + ((performance.now() - c.at) / 1000) * (rate || 1);
      paintRef.current(now);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, rate, lines]);

  // paused (or seeking while paused): paint once
  useEffect(() => {
    if (!isPlaying) paintRef.current(clock.current.t);
  }, [currentTime, activeIdx, offset, isPlaying]);

  if (loading) {
    return <div className="flex items-center gap-2 text-white/60"><Loader2 size={16} className="animate-spin" /> Finding lyrics…</div>;
  }

  if (lines && lines.length) {
    return (
      <div
        ref={containerRef}
        onTouchStart={startBrowsing}
        onTouchMove={startBrowsing}
        onWheel={startBrowsing}
        className="relative flex-1 overflow-y-auto min-h-0 text-center py-[35%] overscroll-contain no-scrollbar"
        style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 12%, #000 88%, transparent 100%)', maskImage: 'linear-gradient(to bottom, transparent 0, #000 12%, #000 88%, transparent 100%)' }}
      >
        {lines.map((l, i) => {
          const active = i === activeIdx;
          const dist = activeIdx < 0 ? i + 1 : Math.abs(i - activeIdx);
          const blur = active ? 0 : Math.min(4.5, 0.8 + dist * 0.7);
          const opacity = active ? 1 : Math.max(0.28, 0.78 - dist * 0.09);
          if (active) wordRefs.current = [];
          const words = active ? splitWords(l.text) : [];
          return (
            <p
              key={i}
              ref={(el) => (lineRefs.current[i] = el)}
              onClick={() => { if (onSeek && typeof l.time === 'number') onSeek(Math.max(0, l.time - offset)); }}
              className={`font-lyric px-3 my-3.5 leading-snug cursor-pointer origin-center ${active ? `${sz.on} font-bold` : `${sz.off} font-semibold text-white`}`}
              style={{
                filter: `blur(${blur}px) drop-shadow(0 0 ${active ? 16 : 0}px rgba(255,255,255,${active ? 0.3 : 0}))`,
                opacity,
                transform: active ? 'scale(1.04)' : 'scale(1)',
                transition: 'filter 450ms ease, opacity 450ms ease, transform 450ms cubic-bezier(.2,.8,.2,1)',
              }}
            >
              {active
                ? (words.length
                  ? words.map((w, wi) => (
                    <React.Fragment key={wi}>
                      <span className="ly-word" ref={(el) => { wordRefs.current[wi] = el; }}>{w}</span>{' '}
                    </React.Fragment>
                  ))
                  : <span className="ly-dots" aria-label="Instrumental"><i /><i /><i /></span>)
                : (l.text || '♪')}
            </p>
          );
        })}
      </div>
    );
  }

  if (plain) {
    return <div className="flex-1 overflow-y-auto min-h-0 text-lg leading-relaxed whitespace-pre-line text-white/90 font-lyric overscroll-contain no-scrollbar">{plain}</div>;
  }

  if (failed) return <div className="text-white/60">Couldn't load lyrics right now.</div>;
  return <div className="text-white/60">No lyrics found for this track.</div>;
}
