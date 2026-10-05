import React from 'react';
import { usePlayer } from '@/lib/PlayerContext';
import { useMusicLibrary } from '@/lib/useMusicLibrary';
import { useAlbumColor } from '@/lib/useAlbumColor';
import NowPlaying from '@/components/NowPlaying';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, Heart, Loader2 } from 'lucide-react';

function fmt(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const stop = (e) => e.stopPropagation();

// Spotify-style mini player: a small rounded card tinted with the song's colour.
// Tap anywhere on it to open the full screen player.
export default function PlayerBar() {
  const p = usePlayer();
  const lib = useMusicLibrary();
  const t = p.current;
  const color = useAlbumColor(t?.thumbnail, `${t?.title || ''}${t?.artist || ''}`);
  if (!t) return null;
  const saved = lib.savedIds && lib.savedIds.has(t.videoId);
  const pct = p.duration ? Math.min(100, (p.currentTime / p.duration) * 100) : 0;

  return (
    <>
      <div className="player-bar-pos fixed left-0 right-0 z-40 px-2 pb-2 md:px-0 md:pb-0">
        <div
          onClick={p.openNowPlaying}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') p.openNowPlaying(); }}
          className="relative overflow-hidden cursor-pointer rounded-xl md:rounded-none shadow-2xl md:border-t md:border-white/10 px-2.5 py-2 md:px-4 md:py-2.5"
          style={{ backgroundColor: color, transition: 'background-color 800ms ease' }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.25), rgba(0,0,0,0.55))' }} />
          <div className="relative max-w-7xl mx-auto flex items-center gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-none md:w-[28%]">
              <img src={t.thumbnail} alt="" className="w-10 h-10 md:w-12 md:h-12 rounded-md object-cover shadow-lg shrink-0" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{t.title}</div>
                <div className="truncate text-xs text-white/70">{t.artist}</div>
              </div>
            </div>

            {/* desktop: full controls + seek bar */}
            <div className="hidden md:flex flex-1 flex-col items-center gap-1 min-w-0" onClick={stop}>
              <div className="flex items-center gap-5">
                <button onClick={p.toggleShuffle} className={p.shuffle ? 'text-primary' : 'text-white/70 hover:text-white'} aria-label="Shuffle"><Shuffle size={17} /></button>
                <button onClick={p.prev} className="p-1.5 text-white/90 hover:text-white" aria-label="Previous"><SkipBack size={20} /></button>
                <button onClick={p.togglePlay} className="bg-white text-black rounded-full p-2.5 shadow-lg hover:scale-105 transition" aria-label="Play/Pause">
                  {p.resolving ? <Loader2 size={20} className="animate-spin" /> : p.isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>
                <button onClick={p.next} className="p-1.5 text-white/90 hover:text-white" aria-label="Next"><SkipForward size={20} /></button>
                <button onClick={p.toggleRepeat} className={p.repeat ? 'text-primary' : 'text-white/70 hover:text-white'} aria-label="Repeat"><Repeat size={17} /></button>
              </div>
              <div className="w-full flex items-center gap-2 text-[11px] text-white/70">
                <span className="w-9 text-right tabular-nums">{fmt(p.currentTime)}</span>
                <input type="range" min={0} max={p.duration || 0} step={0.1} value={Math.min(p.currentTime, p.duration || 0)} onChange={(e) => p.seek(Number(e.target.value))} className="flex-1" aria-label="Seek" />
                <span className="w-9 tabular-nums">{fmt(p.duration)}</span>
              </div>
            </div>

            {/* phone: heart + play/pause only, like Spotify */}
            <div className="flex items-center gap-1 md:hidden" onClick={stop}>
              <button onClick={() => lib.toggleSave(t)} aria-label="Like" className={`p-2 ${saved ? 'text-primary' : 'text-white/80'}`}><Heart size={20} fill={saved ? 'currentColor' : 'none'} /></button>
              <button onClick={p.togglePlay} aria-label="Play/Pause" className="p-2 text-white">
                {p.resolving ? <Loader2 size={24} className="animate-spin" /> : p.isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 w-[18%] justify-end" onClick={stop}>
              <button onClick={() => lib.toggleSave(t)} aria-label="Like" className={saved ? 'text-primary' : 'text-white/70 hover:text-white'}><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></button>
              <button onClick={p.toggleMute} className="text-white/80 hover:text-white" aria-label="Mute">{p.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
              <input type="range" min={0} max={100} value={p.muted ? 0 : p.volume} onChange={(e) => p.setVolume(Number(e.target.value))} className="w-24" aria-label="Volume" />
            </div>
          </div>

          {/* thin progress line (phones) */}
          <div className="md:hidden absolute left-2.5 right-2.5 bottom-0.5 h-[2px] rounded bg-white/25 pointer-events-none">
            <div className="h-full rounded bg-white" style={{ width: `${pct}%`, transition: 'width 250ms linear' }} />
          </div>
        </div>
      </div>
      <NowPlaying />
    </>
  );
}
