import React, { useEffect, useState } from 'react';
import { usePlayer } from '@/lib/PlayerContext';
import { useMusicLibrary } from '@/lib/useMusicLibrary';
import ShareButton from '@/components/ShareButton';
import LyricsView from '@/components/LyricsView';
// base44 removed — using fetch to /api/getLyrics instead
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, Heart, Loader2 } from 'lucide-react';

export default function NowPlaying() {
  const p = usePlayer();
  const lib = useMusicLibrary();
  const t = p.current;
  const [lyricLines, setLyricLines] = useState([]);
  const [lyricPlain, setLyricPlain] = useState('');
  const [loadingL, setLoadingL] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!p.nowPlayingOpen || !t) return;
    let active = true;
    setLyricLines([]);
    setLyricPlain('');
    setFailed(false);
    setLoadingL(true);
    const safety = setTimeout(() => { if (active) setLoadingL(false); }, 12000);
    (async () => {
      try {
        const res = await fetch('/api/getLyrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artist: t.artist, title: t.title }) }).then(r => r.json());
        if (active) {
          setLyricLines(res.data?.lines || []);
          setLyricPlain(res.data?.plain || '');
        }
      } catch {
        if (active) setFailed(true);
      }
      if (active) setLoadingL(false);
    })();
    return () => { active = false; clearTimeout(safety); };
  }, [p.nowPlayingOpen, t?.videoId]);

  if (!p.nowPlayingOpen || !t) return null;
  const saved = lib.savedIds && lib.savedIds.has(t.videoId);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      <img src={t.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover blur-3xl scale-150 opacity-25" />
      <div className="absolute inset-0 bg-black/75" />
      <div className="relative flex flex-col h-full max-w-4xl mx-auto w-full px-5 py-4 gap-3">
        <div className="flex items-center justify-between shrink-0">
          <button onClick={p.closeNowPlaying} className="p-2 rounded-full glass text-white/80 hover:text-white"><ChevronDown size={22} /></button>
          <div className="text-xs uppercase tracking-wide text-white/40">Now Playing</div>
          <div className="w-9" />
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-5">
          <div className="md:w-1/2 flex flex-col items-center justify-center gap-3 min-h-0">
            <img src={t.thumbnail} alt="" className="w-36 h-36 md:w-48 md:h-48 rounded-2xl object-cover shadow-2xl shrink-0" />
            <div className="text-center px-2 w-full">
              <div className="text-lg font-bold truncate">{t.title}</div>
              <div className="text-white/60 truncate text-sm">{t.artist}</div>
            </div>
            <div className="flex items-center gap-5 mt-1">
              <button onClick={p.toggleShuffle} className={p.shuffle ? 'text-primary' : 'text-white/70 hover:text-white'}><Shuffle size={18} /></button>
              <button onClick={p.prev} className="text-white/80 hover:text-white"><SkipBack size={22} /></button>
              <button onClick={p.togglePlay} className="bg-primary text-primary-foreground rounded-full p-3.5 shadow-lg hover:scale-105 transition">{p.isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}</button>
              <button onClick={p.next} className="text-white/80 hover:text-white"><SkipForward size={22} /></button>
              <button onClick={p.toggleRepeat} className={p.repeat ? 'text-primary' : 'text-white/70 hover:text-white'}><Repeat size={18} /></button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button onClick={() => lib.toggleSave(t)} className={`flex items-center gap-1.5 text-sm ${saved ? 'text-primary' : 'text-white/60 hover:text-white'}`}>
                <Heart size={16} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved to Liked' : 'Save to Liked'}
              </button>
              <span className="text-white/20">·</span>
              <ShareButton track={t} title="Copy link" />
            </div>
            {lib.isAuthenticated && (
              <div className="text-[11px] text-white/40 mt-1">Saved songs sync across your devices.</div>
            )}
          </div>

          <div className="md:w-1/2 flex flex-col min-h-0 glass rounded-2xl p-4">
            <LyricsView lines={lyricLines} plain={lyricPlain} currentTime={p.currentTime} loading={loadingL} failed={failed} />
          </div>
        </div>
      </div>
    </div>
  );
}
