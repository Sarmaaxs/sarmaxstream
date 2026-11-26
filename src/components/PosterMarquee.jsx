import { cachedJson } from '@/lib/cache';
import React, { useEffect, useState } from 'react';
// base44 removed — using fetch to /api/searchMusic instead

export default function PosterMarquee() {
  const [imgs, setImgs] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await cachedJson('/api/searchMusic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'trending', maxResults: 24 }) }, 60 * 60 * 1000);
        setImgs((res.tracks || []).map((t) => t.thumbnail).filter(Boolean));
      } catch {}
    })();
  }, []);

  if (!imgs.length) return null;
  const col1 = imgs.slice(0, 12);
  const col2 = imgs.slice(12, 24);

  const Col = ({ items, cls }) => (
    <div className="flex-1 h-full overflow-hidden mask-fade">
      <div className={`flex flex-col gap-4 ${cls}`}>
        {[...items, ...items].map((src, i) => (
          <img key={i} src={src} alt="" className="w-full aspect-square rounded-2xl object-cover shrink-0 shadow-2xl border border-white/10" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 flex gap-6 px-6">
      <Col items={col1} cls="animate-marquee-up" />
      <Col items={col2} cls="animate-marquee-down" />
    </div>
  );
}
