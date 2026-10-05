import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

// Spotify-style lyrics: the line being sung is big and bright, the lines around it are
// blurred more the further away they are. Touch or scroll to read freely (blur turns off for a moment),
// tap a line to jump to it.
export default function LyricsView({ lines, plain, currentTime, loading, failed, offset = 0, onSeek }) {
  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const userScrollUntil = useRef(0);
  const browseTimer = useRef(0);
  const [browsing, setBrowsing] = useState(false);

  const t = (currentTime || 0) + offset;
  let activeIdx = -1;
  if (lines && lines.length) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= t) activeIdx = i;
      else break;
    }
  }

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
  }, [activeIdx, browsing]);

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
          const near = dist <= 6;
          const blur = browsing || active ? 0 : near ? Math.min(4.5, 0.8 + dist * 0.7) : 0;
          const opacity = browsing ? 0.8 : active ? 1 : near ? Math.max(0.35, 0.78 - dist * 0.09) : 0.25;
          return (
            <p
              key={i}
              ref={(el) => (lineRefs.current[i] = el)}
              onClick={() => { if (onSeek && typeof l.time === 'number') onSeek(Math.max(0, l.time - offset)); }}
              className={`font-lyric px-3 my-3.5 leading-snug cursor-pointer origin-center ${active ? 'text-white text-2xl md:text-3xl font-bold' : 'text-white text-xl md:text-2xl font-semibold'}`}
              style={{
                filter: blur ? `blur(${blur}px)` : 'none',
                opacity,
                transform: active ? 'scale(1.04)' : 'scale(1)',
                transition: 'filter 450ms ease, opacity 450ms ease, transform 450ms cubic-bezier(.2,.8,.2,1)',
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
