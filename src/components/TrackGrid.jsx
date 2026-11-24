import React from 'react';
import { Play, Pause, Heart } from 'lucide-react';
import { usePlayer } from '@/lib/PlayerContext';
import AnimatedButton from '@/components/AnimatedButton';

function parseDur(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = +(m[1] || 0), mi = +(m[2] || 0), s = +(m[3] || 0);
  const pad = (n) => n.toString().padStart(2, '0');
  return h ? `${h}:${pad(mi)}:${pad(s)}` : `${mi}:${pad(s)}`;
}

// Material 3 style cards (Soundbound look).
// layout="grid" (default) wraps into a grid; layout="row" is a swipeable shelf.
export default function TrackGrid({ tracks, savedIds, onToggleSave, emptyText = 'No tracks to show.', layout = 'grid' }) {
  const player = usePlayer();
  if (!tracks.length) return <div className="text-white/40 text-sm py-10 text-center glass rounded-3xl">{emptyText}</div>;

  const row = layout === 'row';
  const wrap = row
    ? 'flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 scroll-pl-4 sm:scroll-pl-6 lg:scroll-pl-10 pb-1'
    : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4';

  return (
    <div className={wrap}>
      {tracks.map((t, i) => {
        const playing = player.current && (player.current.videoId === t.videoId || player.current.catalogId === t.videoId);
        return (
          <div
            key={t.videoId + i}
            onClick={() => (playing ? player.togglePlay() : player.playTrack(t, tracks))}
            className={`group glass glass-hover rounded-3xl p-2.5 cursor-pointer flex flex-col ${row ? 'w-40 sm:w-44 shrink-0 snap-start' : ''} ${playing ? '!bg-secondary' : ''}`}
          >
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-2.5">
              <img src={t.thumbnail} alt="" className="w-full h-full object-cover" />
              <span
                className={`absolute right-2 bottom-2 bg-primary text-primary-foreground rounded-2xl w-10 h-10 flex items-center justify-center shadow-lg transition ${playing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              >
                {playing && player.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </span>
            </div>
            <div className={`truncate text-sm font-medium px-0.5 ${playing ? 'text-primary' : 'text-foreground'}`}>{t.title}</div>
            <div className="truncate text-xs text-muted-foreground px-0.5">{t.artist}</div>
            <div className="flex items-center justify-between mt-1.5 gap-2 px-0.5">
              <span className="text-[11px] text-white/40 truncate">{parseDur(t.duration) || 'Track'}</span>
              <div className="flex items-center gap-1 shrink-0">
                {playing && <span className="text-[11px] text-primary">Playing</span>}
                {onToggleSave && (
                  <AnimatedButton variant="icon" onClick={(e) => { e.stopPropagation(); onToggleSave(t); }} className={`p-1 rounded-full hover:bg-white/10 ${savedIds && savedIds.has(t.videoId) ? 'text-primary' : 'text-white/40 hover:text-white'}`} title="Save to Liked">
                    <Heart size={15} fill={savedIds && savedIds.has(t.videoId) ? 'currentColor' : 'none'} />
                  </AnimatedButton>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
