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

export default function TrackGrid({ tracks, savedIds, onToggleSave, emptyText = 'No tracks to show.' }) {
  const player = usePlayer();
  if (!tracks.length) return <div className="text-white/40 text-sm py-10 text-center glass rounded-2xl">{emptyText}</div>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {tracks.map((t, i) => {
        const playing = player.current && (player.current.videoId === t.videoId || player.current.catalogId === t.videoId);
        return (
          <div key={t.videoId + i} onClick={() => (playing ? player.togglePlay() : player.playTrack(t, tracks))} className="group glass glass-hover rounded-2xl p-3 cursor-pointer flex flex-col">
            <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3">
              <img src={t.thumbnail} alt="" className="w-full h-full object-cover" />
              <AnimatedButton
                as="span"
                variant="icon"
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition"
              >
                <span className="bg-primary text-primary-foreground rounded-full p-3 shadow-lg">
                  {playing && player.isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </span>
              </AnimatedButton>
            </div>
            <div className={`truncate text-sm font-medium ${playing ? 'text-primary' : 'text-white'}`}>{t.title}</div>
            <div className="truncate text-xs text-white/50">{t.artist}</div>
            <div className="flex items-center justify-between mt-1.5 gap-2">
              <span className="text-[11px] text-white/40 truncate">{parseDur(t.duration) || 'Track'}</span>
              <div className="flex items-center gap-1 shrink-0">
                {playing && <span className="text-[11px] text-primary">Playing</span>}
                {onToggleSave && (
                  <AnimatedButton variant="icon" onClick={(e) => { e.stopPropagation(); onToggleSave(t); }} className={`p-1 rounded-lg hover:bg-white/10 ${savedIds && savedIds.has(t.videoId) ? 'text-primary' : 'text-white/40 hover:text-white'}`} title="Save to Liked">
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
