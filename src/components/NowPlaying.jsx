import React, { useEffect, useState } from 'react';
import { usePlayer } from '@/lib/PlayerContext';
import { useMusicLibrary } from '@/lib/useMusicLibrary';
import ShareButton from '@/components/ShareButton';
import LyricsView from '@/components/LyricsView';
// base44 removed — using fetch to /api/getLyrics instead
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, Heart } from 'lucide-react';

const LYRICS_CACHE_PREFIX = 'sarmax_lyrics_v2:';
const OFFSET_PREFIX = 'sarmax_lyric_offset:';

function readJSON(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } }
function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function fmt(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
}

export default function NowPlaying() {
  const p = usePlayer();
  const lib = useMusicLibrary();
  const t = p.current;
  const [lyricLines, setLyricLines] = useState([]);
  const [lyricPlain, setLyricPlain] = useState('');
  const [loadingL, setLoadingL] = useState(false);
  const [failed, setFailed] = useState(false);
  const [offset, setOffset] = useState(0);

  // Remember a per-song lyric offset for next visit.
  useEffect(() => {
    if (!t) return;
    const saved = readJSON(OFFSET_PREFIX + t.videoId);
    setOffset(typeof saved === 'number' ? saved : 0);
  }, [t?.videoId]);
  const nudge = (d) => {
    setOffset((o) => {
      const n = Math.round((o + d) * 10) / 10;
      writeJSON(OFFSET_PREFIX + t.videoId, n);
      return n;
    });
  };

  const durKnown = p.duration > 0 ? Math.round(p.duration) : 0;
  // Wait (max 3s) for the real song length so we can pick the matching lyric
  // version; the length is what makes synced lyrics line up.
  const [waitedId, setWaitedId] = useState(null);
  useEffect(() => {
    if (!p.nowPlayingOpen || !t) return;
    const id = setTimeout(() => setWaitedId(t.videoId), 3000);
    return () => clearTimeout(id);
  }, [p.nowPlayingOpen, t?.videoId]);
  const lyricsReady = durKnown > 0 || (t && waitedId === t.videoId);

  useEffect(() => {
    if (!p.nowPlayingOpen || !t || !lyricsReady) return;
    let active = true;
    const cached = readJSON(LYRICS_CACHE_PREFIX + t.videoId);
    if (cached && (cached.lines?.length || cached.plain)) {
      setLyricLines(cached.lines || []);
      setLyricPlain(cached.plain || '');
      setFailed(false);
      setLoadingL(false);
      return () => { active = false; };
    }
    setLyricLines([]);
    setLyricPlain('');
    setFailed(false);
    setLoadingL(true);
    const safety = setTimeout(() => { if (active) setLoadingL(false); }, 14000);
    (async () => {
      try {
        const res = await fetch('/api/getLyrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artist: t.artist, title: t.title, duration: durKnown }),
        }).then((r) => r.json());
        if (active) {
          setLyricLines(res.lines || []);
          setLyricPlain(res.plain || '');
          if ((res.lines && res.lines.length) || res.plain) {
            writeJSON(LYRICS_CACHE_PREFIX + t.videoId, { lines: res.lines || [], plain: res.plain || '' });
          }
        }
      } catch {
        if (active) setFailed(true);
      }
      if (active) setLoadingL(false);
    })();
    return () => { active = false; clearTimeout(safety); };
  }, [p.nowPlayingOpen, t?.videoId, lyricsReady]);

  if (!p.nowPlayingOpen || !t) return null;
  const saved = lib.savedIds && lib.savedIds.has(t.videoId);

  const hasSynced = lyricLines.length > 0;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex flex-col h-[100dvh]" style={{ height: '100dvh' }}>
      <img src={t.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover blur-3xl scale-150 opacity-25" />
      <div className="absolute inset-0 bg-black/75" />
      <div
        className="relative flex flex-col h-full max-w-4xl mx-auto w-full px-4 sm:px-5 gap-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <div className="flex items-center justify-between shrink-0">
          <button onClick={p.closeNowPlaying} aria-label="Close" className="p-3 -m-1 rounded-full glass text-white/80 hover:text-white"><ChevronDown size={22} /></button>
          <div className="text-xs uppercase tracking-wide text-white/40">Now Playing</div>
          <button onClick={() => lib.toggleSave(t)} aria-label="Like" className={`p-3 -m-1 rounded-full glass ${saved ? 'text-primary' : 'text-white/70'}`}>
            <Heart size={20} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 md:gap-5">
          {/* Song info: compact row on phones, big card on desktop */}
          <div className="md:w-1/2 flex md:flex-col items-center md:justify-center gap-3 shrink-0 md:shrink">
            <img src={t.thumbnail} alt="" className="w-16 h-16 md:w-48 md:h-48 rounded-xl md:rounded-2xl object-cover shadow-2xl shrink-0" />
            <div className="min-w-0 flex-1 md:flex-none md:text-center md:w-full">
              <div className="text-base md:text-lg font-bold truncate">{t.title}</div>
              <div className="text-white/60 truncate text-sm">{t.artist}</div>
              <div className="hidden md:block mt-1"><ShareButton track={t} title="Copy link" /></div>
            </div>
          </div>

          {/* Lyrics fill whatever space is left, so controls never get pushed off-screen */}
          <div className="md:w-1/2 flex flex-col flex-1 min-h-0 glass rounded-2xl p-4">
            <LyricsView lines={lyricLines} plain={lyricPlain} currentTime={p.currentTime} loading={loadingL || !lyricsReady} failed={failed} offset={offset} />
            {hasSynced && (
              <div className="shrink-0 flex items-center justify-center gap-3 pt-2 text-[11px] text-white/45">
                <button onClick={() => nudge(-0.5)} className="px-3 py-1.5 rounded-full glass">Lyrics later</button>
                <span className="tabular-nums w-12 text-center">{offset > 0 ? '+' : ''}{offset.toFixed(1)}s</span>
                <button onClick={() => nudge(0.5)} className="px-3 py-1.5 rounded-full glass">Lyrics earlier</button>
              </div>
            )}
          </div>
        </div>

        {/* Controls pinned to the bottom, always reachable */}
        <div className="shrink-0 space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-white/50">
            <span className="w-9 text-right tabular-nums">{fmt(p.currentTime)}</span>
            <input type="range" min={0} max={p.duration || 0} step={0.1} value={Math.min(p.currentTime, p.duration || 0)} onChange={(e) => p.seek(Number(e.target.value))} className="flex-1 h-8" aria-label="Seek" />
            <span className="w-9 tabular-nums">{fmt(p.duration)}</span>
          </div>
          <div className="flex items-center justify-center gap-6">
            <button onClick={p.toggleShuffle} aria-label="Shuffle" className={`p-2 ${p.shuffle ? 'text-primary' : 'text-white/70'}`}><Shuffle size={20} /></button>
            <button onClick={p.prev} aria-label="Previous" className="p-2 text-white/80"><SkipBack size={26} /></button>
            <button onClick={p.togglePlay} aria-label="Play/Pause" className="bg-primary text-primary-foreground rounded-full p-4 shadow-lg active:scale-95 transition">{p.isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}</button>
            <button onClick={p.next} aria-label="Next" className="p-2 text-white/80"><SkipForward size={26} /></button>
            <button onClick={p.toggleRepeat} aria-label="Repeat" className={`p-2 ${p.repeat ? 'text-primary' : 'text-white/70'}`}><Repeat size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
