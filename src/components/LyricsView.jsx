import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const SIZES = {
  s: { on: 'text-xl md:text-2xl', off: 'text-lg md:text-xl' },
  m: { on: 'text-2xl md:text-3xl', off: 'text-xl md:text-2xl' },
  l: { on: 'text-3xl md:text-4xl', off: 'text-2xl md:text-3xl' },
};

function lineIndexAt(lines, t) {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= t) idx = i;
    else break;
  }
  return idx;
}

export default function LyricsView({ lines, plain, currentTime, loading, failed, offset = 0, onSeek, size = 'm' }) {
  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const userScrollUntil = useRef(0);
  const browseTimer = useRef(0);
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
          const blur = active ? 0 : Math.min(3.5, 0.6 + dist * 0.55);
          const opacity = active ? 1 : Math.max(0.32, 0.8 - dist * 0.1);
          return (
            <p
              key={i}
              ref={(el) => (lineRefs.current[i] = el)}
              onClick={() => { if (onSeek && typeof l.time === 'number') onSeek(Math.max(0, l.time - offset)); }}
              className={`font-lyric px-3 my-3.5 leading-snug cursor-pointer origin-center ${active ? `${sz.on} font-bold text-white` : `${sz.off} font-semibold text-white`}`}
              style={{
                filter: `blur(${blur}px)`,
                opacity,
                transform: active ? 'scale(1.03)' : 'scale(1)',
                transition: 'filter 400ms ease, opacity 400ms ease, transform 400ms ease',
              }}
            >
              {l.text || '♪'}
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
