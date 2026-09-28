import React from 'react';
import { usePlayer } from '@/lib/PlayerContext';
import NowPlaying from '@/components/NowPlaying';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, ChevronUp } from 'lucide-react';

function fmt(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerBar() {
  const p = usePlayer();
  if (!p.current) return null;

  return (
    <>
      <div className="player-bar-pos fixed left-0 right-0 z-40 glass-strong border-t border-white/10 px-3 py-2 md:px-4 md:pb-2.5">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={p.openNowPlaying} className="flex items-center gap-3 min-w-0 w-[46%] md:w-[28%] text-left group">
            <img src={p.current.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover shadow-lg shrink-0" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{p.current.title}</div>
              <div className="truncate text-xs text-white/55">{p.current.artist}</div>
            </div>
            <ChevronUp size={16} className="text-white/40 group-hover:text-primary shrink-0" />
          </button>

          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="flex items-center gap-3 md:gap-5">
              <button onClick={p.toggleShuffle} className={`hidden sm:block ${p.shuffle ? 'text-primary' : 'text-white/60 hover:text-white'}`} aria-label="Shuffle"><Shuffle size={17} /></button>
              <button onClick={p.prev} className="p-1.5 text-white/80 hover:text-white" aria-label="Previous"><SkipBack size={20} /></button>
              <button onClick={p.togglePlay} className="bg-primary text-primary-foreground rounded-full p-2.5 shadow-lg hover:scale-105 transition" aria-label="Play/Pause">
                {p.isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
              <button onClick={p.next} className="p-1.5 text-white/80 hover:text-white" aria-label="Next"><SkipForward size={20} /></button>
              <button onClick={p.toggleRepeat} className={`hidden sm:block ${p.repeat ? 'text-primary' : 'text-white/60 hover:text-white'}`} aria-label="Repeat"><Repeat size={17} /></button>
            </div>
            <div className="w-full flex items-center gap-2 text-[11px] text-white/50">
              <span className="w-9 text-right tabular-nums">{fmt(p.currentTime)}</span>
              <input type="range" min={0} max={p.duration || 0} step={0.1} value={Math.min(p.currentTime, p.duration || 0)} onChange={(e) => p.seek(Number(e.target.value))} className="flex-1" />
              <span className="w-9 tabular-nums">{fmt(p.duration)}</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 w-[18%] justify-end">
            <button onClick={p.toggleMute} className="text-white/70 hover:text-white">{p.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
            <input type="range" min={0} max={100} value={p.muted ? 0 : p.volume} onChange={(e) => p.setVolume(Number(e.target.value))} className="w-24" />
          </div>
        </div>
      </div>
      <NowPlaying />
    </>
  );
}
