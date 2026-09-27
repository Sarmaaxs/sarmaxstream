import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export default function LyricsView({ lines, plain, currentTime, loading, failed }) {
  const containerRef = useRef(null);
  const lineRefs = useRef([]);

  let activeIdx = -1;
  if (lines && lines.length) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime) activeIdx = i;
      else break;
    }
  }

  useEffect(() => {
    if (activeIdx < 0) return;
    const el = lineRefs.current[activeIdx];
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIdx]);

  if (loading) {
    return <div className="flex items-center gap-2 text-white/40"><Loader2 size={16} className="animate-spin" /> Finding lyrics…</div>;
  }

  if (lines && lines.length) {
    return (
      <div ref={containerRef} className="flex-1 overflow-auto min-h-0 text-center py-[38%]">
        {lines.map((l, i) => {
          const active = i === activeIdx;
          const past = i < activeIdx;
          return (
            <p
              key={i}
              ref={(el) => (lineRefs.current[i] = el)}
              className={`font-lyric transition-all duration-300 px-2 my-3 leading-snug ${active ? 'text-white text-2xl md:text-3xl font-semibold scale-[1.02]' : past ? 'text-white/35 text-lg' : 'text-white/35 text-lg blur-[3px]'}`}
            >
              {l.text || '♪'}
            </p>
          );
        })}
      </div>
    );
  }

  if (plain) {
    return <div className="flex-1 overflow-auto min-h-0 text-base leading-relaxed whitespace-pre-line text-white/85 font-lyric">{plain}</div>;
  }

  if (failed) return <div className="text-white/40">Couldn't load lyrics right now.</div>;
  return <div className="text-white/40">No lyrics found for this track.</div>;
}
