import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayer } from '@/lib/PlayerContext';
// base44 removed — using fetch to /api/searchMusic instead
import TrackGrid from '@/components/TrackGrid';
import { X, Loader2 } from 'lucide-react';

const DOG_IMG = 'https://media.base44.com/images/public/6ab271a89243f8ecdabc30f5/80c66e03c_generated_acfcb915.png';

const FALLBACK_POOL = [
  'Blinding Lights', 'Shape of You', 'Levitating', 'As It Was', 'Bad Guy',
  'Watermelon Sugar', 'Drivers License', 'Stay', 'Heat Waves', 'Good 4 U',
  'Anti-Hero', 'Flowers', 'Cruel Summer', 'Espresso', 'Die With A Smile',
  'Perfect', 'Someone Like You', 'Believer', 'Thunder', 'Happier'];


export default function DogMascot() {
  const player = usePlayer();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState('searching');
  const [recs, setRecs] = useState([]);
  const [flashIdx, setFlashIdx] = useState(0);
  const [pool, setPool] = useState([]);

  useEffect(() => {
    if (!open || phase !== 'searching') return;
    const id = setInterval(() => setFlashIdx((i) => i + 1), 70);
    return () => clearInterval(id);
  }, [open, phase]);

  const buildRecs = useCallback(async () => {
    const recent = player.recent || [];
    const artists = Array.from(new Set(recent.map((t) => t.artist).filter(Boolean))).slice(0, 5);
    const tasks = artists.map((a) =>
    fetch('/api/searchMusic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: a, mode: 'search', maxResults: 6 }) }).then(r => r.json()).
    then((r) => r.tracks || []).catch(() => [])
    );
    tasks.push(
      fetch('/api/searchMusic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'trending', maxResults: 24 }) }).then(r => r.json()).
      then((r) => r.tracks || []).catch(() => [])
    );
    const results = await Promise.all(tasks);
    let all = [];
    results.forEach((arr) => {all = all.concat(arr);});
    const seen = new Set();
    const dedup = [];
    for (const t of all) {
      if (!t.videoId || seen.has(t.videoId)) continue;
      seen.add(t.videoId);
      dedup.push(t);
    }
    return dedup.slice(0, 20);
  }, [player.recent]);

  const handleOpen = useCallback(async () => {
    setOpen(true);
    setPhase('searching');
    setRecs([]);
    setFlashIdx(0);
    const recent = player.recent || [];
    setPool([...recent.map((t) => t.title).filter(Boolean), ...FALLBACK_POOL]);
    const start = Date.now();
    const tracks = await buildRecs();
    const elapsed = Date.now() - start;
    if (elapsed < 1600) await new Promise((r) => setTimeout(r, 1600 - elapsed));
    setRecs(tracks);
    setPool(tracks.map((t) => t.title));
    setPhase('list');
  }, [buildRecs, player.recent]);

  if (!open) {
    return (
      <div className="dog-walk pointer-events-none fixed bottom-24 left-0 z-[55]" style={{ width: 72, height: 72 }}>
      </div>
    );
  }

  const titles = pool.length ? pool : FALLBACK_POOL;
  const showTitle = titles[flashIdx % titles.length];

  return (
    <div className="fixed inset-0 z-[70] flex flex-col">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" />
      <div className="relative flex items-center justify-between px-5 py-4 shrink-0">
        <button onClick={() => setOpen(false)} className="p-2 rounded-full glass text-white/80 hover:text-white"><X size={22} /></button>
        <div className="flex items-center gap-2">
          <img src={DOG_IMG} alt="" className="w-7 h-7 object-contain" />
          <span className="font-display font-bold"><span className="text-white">sarmax</span><span className="text-primary">stream</span></span>
        </div>
        <div className="w-9" />
      </div>

      {phase === 'searching' ?
      <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
          <div className="mask-fade flex flex-col gap-2 opacity-25 select-none animate-marquee-up" style={{ height: '60vh' }}>
            {[...titles, ...titles, ...titles].map((tt, i) =>
          <div key={i} className="text-2xl font-display font-bold text-white/50 truncate text-center px-6">{tt}</div>
          )}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
            <img src={DOG_IMG} alt="" className="w-20 h-20 object-contain animate-bounce" />
            <div className="text-3xl md:text-5xl font-display font-extrabold text-white text-center truncate max-w-full">{showTitle}</div>
            <div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 size={15} className="animate-spin" /> scanning the airwaves…</div>
          </div>
        </div> :

      <div className="relative flex-1 overflow-auto px-5 pb-10">
          {recs.length ? <TrackGrid tracks={recs} /> : <div className="text-white/50 text-center py-20">Nothing to play yet — listen to a few songs first.</div>}
        </div>
      }
    </div>
  );
}
