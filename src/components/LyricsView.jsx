import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

// offset (seconds): positive = show lyrics EARLIER, negative = LATER.
// Lets the user nudge lyrics when the YouTube video has a different intro
// than the studio version the lyrics were timed against.
export default function LyricsView({ lines, plain, currentTime, loading, failed, offset = 0 }) {
  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const userScrollUntil = useRef(0);

  const t = (currentTime || 0) + offset;
  let activeIdx = -1;
  if (lines && lines.length) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= t) activeIdx = i;
      else break;
    }
  }

  // Scroll ONLY the lyrics box (scrollIntoView also scrolls the page/ancestors,
  // which pushes the controls off-screen on phones).
  useEffect(() => {
    if (activeIdx < 0) return;
    if (Date.now() < userScrollUntil.current) return; // user is reading ahead
    const box = containerRef.current;
    const el = lineRefs.current[activeIdx];
    if (!box || !el) return;
    const target = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [activeIdx]);

  useEffect(() => { lineRefs.current = []; }, [lines]);

  if (loading) {
    return <div className="flex items-center gap-2 text-white/40"><Loader2 size={16} className="animate-spin" /> Finding lyrics…</div>;
  }

  if (lines && lines.length) {
    return (
      <div
        ref={containerRef}
        onTouchStart={() => { userScrollUntil.current = Date.now() + 4000; }}
        onWheel={() => { userScrollUntil.current = Date.now() + 4000; }}
        className="relative flex-1 overflow-y-auto min-h-0 text-center py-[30%] overscroll-contain"
      >
        {lines.map((l, i) => {
          const active = i === activeIdx;
          const past = i < activeIdx;
          return (
            <p
              key={i}
              ref={(el) => (lineRefs.current[i] = el)}
              className={`font-lyric transition-all duration-300 px-2 my-3 leading-snug ${active ? 'text-white text-2xl md:text-3xl font-semibold scale-[1.02]' : past ? 'text-white/35 text-lg' : 'text-white/35 text-lg'}`}
            >
              {l.text || '♪'}
            </p>
          );
        })}
      </div>
    );
  }

  if (plain) {
    return <div className="flex-1 overflow-y-auto min-h-0 text-base leading-relaxed whitespace-pre-line text-white/85 font-lyric overscroll-contain">{plain}</div>;
  }

  if (failed) return <div className="text-white/40">Couldn't load lyrics right now.</div>;
  return <div className="text-white/40">No lyrics found for this track.</div>;
}
