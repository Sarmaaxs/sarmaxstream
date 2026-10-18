import React, { useEffect, useState } from 'react';
import { cachedJson } from '@/lib/cache';
import { useAlbumColor } from '@/lib/useAlbumColor';
import { usePlayer } from '@/lib/PlayerContext';
import { useMusicLibrary } from '@/lib/useMusicLibrary';
import ShareButton from '@/components/ShareButton';
import LyricsView from '@/components/LyricsView';
import Equalizer from '@/components/Equalizer';
import { useSettings } from '@/lib/useSettings';
import { isNative } from '@/lib/native';
import { saveOffline, downloadFileToDevice, hasOffline } from '@/lib/offlineDownloads';
import { downloadYoutubeOnDevice, deviceDownloadAvailable } from '@/lib/ytDevice';
import {
  ChevronDown, Play, Pause, SkipBack, SkipForward, Repeat, Shuffle,
  Heart, Loader2, Download, Check,
} from 'lucide-react';

const SIZE_KEY = 'sarmax_lyric_size';
const LYRICS_CACHE_PREFIX = 'sarmax_lyrics_v2:';
const OFFSET_PREFIX = 'sarmax_lyric_offset:';

const isAudioId = (id) => typeof id === 'string' && (id.startsWith('aud_') || id.startsWith('jam_'));
const isCatalogId = (id) => typeof id === 'string' && /^(dz|it)_\d+$/.test(id);

function readJSON(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
function writeJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}
function fmt(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
}
function safeFilename(title, artist) {
  const base = [artist, title].filter(Boolean).join(' - ').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'track';
  return base.slice(0, 120) + '.m4a';
}



/** Download via Cobalt-style proxy (YouTube / any supported service). Returns {url, filename}. */



/** Resolve a track to a downloadable source.
 *  Returns { kind: 'free'|'yt', id } or null.
 *  opts.skipFree -> ignore Audius/Jamendo and return a YouTube id (used as fallback).
 *  IMPORTANT: YouTube ids from /api/resolve must NOT be discarded.
 */
async function resolveDownloadableId(track, opts = {}) {
  const id = track.videoId || track.catalogId || '';
  if (!opts.skipFree) {
    if (isAudioId(id)) return { kind: 'free', id };
  }
  if (!opts.forceResolve && /^[A-Za-z0-9_-]{11}$/.test(id)) return { kind: 'yt', id };

  const qs = new URLSearchParams({
    artist: track.artist || '',
    title: track.title || '',
  });
  const dur = Number(track.duration);
  if (dur > 0) qs.set('dur', String(Math.round(dur)));
  if (opts.skipFree) qs.set('skip', 'free');

  const res = await fetch(`/api/resolve?${qs}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!res || !res.videoId) return null;
  if (isAudioId(res.videoId)) return { kind: 'free', id: res.videoId };
  if (/^[A-Za-z0-9_-]{11}$/.test(res.videoId)) return { kind: 'yt', id: res.videoId };
  return null;
}

const urlFor = (src) =>
  src.kind === 'free'
    ? `/api/stream?id=${encodeURIComponent(src.id)}&proxy=1`
    : `/api/downloadMusic?videoId=${encodeURIComponent(src.id)}&stream=1`;

/** Fetch one source and return a real audio Blob, or throw a descriptive error. */
async function fetchAudioBlob(src) {
  const res = await fetch(urlFor(src));
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = String(j.error);
    } catch {}
    throw new Error(`${src.kind}: ${msg}`);
  }
  const blob = await res.blob();
  const ct = (blob.type || res.headers.get('content-type') || '').toLowerCase();
  if (blob.size < 1024 || ct.includes('json') || ct.includes('html') || ct.startsWith('text/')) {
    let hint = '';
    try { hint = (await blob.text()).slice(0, 120); } catch {}
    throw new Error(`${src.kind}: empty/invalid file (${blob.size}B ${ct || 'no type'}) ${hint}`);
  }
  return blob;
}

function extFor(blob) {
  const t = (blob.type || '').toLowerCase();
  if (t.includes('mpeg') || t.includes('mp3')) return '.mp3';
  if (t.includes('mp4') || t.includes('aac') || t.includes('m4a')) return '.m4a';
  if (t.includes('webm')) return '.webm';
  if (t.includes('ogg') || t.includes('opus')) return '.ogg';
  return '.mp3';
}

function forceSaveBlob(blob, filename) {
  const name = filename || 'track.mp3';
  try {
    if (typeof navigator !== 'undefined' && navigator.msSaveOrOpenBlob) {
      navigator.msSaveOrOpenBlob(blob, name);
      return;
    }
  } catch {}
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try { URL.revokeObjectURL(url); } catch {}
    try { a.remove(); } catch {}
  }, 2500);
}

export default function NowPlaying() {
  const p = usePlayer();
  const lib = useMusicLibrary();
  const { playbackSpeed } = useSettings();
  const t = p.current;

  const [lyricLines, setLyricLines] = useState([]);
  const [lyricPlain, setLyricPlain] = useState('');
  const [loadingL, setLoadingL] = useState(false);
  const [failed, setFailed] = useState(false);
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState('lyrics'); // 'lyrics' | 'more' only
  const [lyricSize, setLyricSize] = useState(() => {
    const s = readJSON(SIZE_KEY);
    return s === 's' || s === 'l' ? s : 'm';
  });
  const [more, setMore] = useState([]);
  const [moreLoading, setMoreLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dlState, setDlState] = useState('idle'); // idle | loading | done | error
  const [dlMsg, setDlMsg] = useState('');

  const color = useAlbumColor(t?.thumbnail, `${t?.title || ''}${t?.artist || ''}`);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      p.closeNowPlaying();
    }, 260);
  };

  // "More by this artist"
  useEffect(() => {
    if (!p.nowPlayingOpen || !t || tab !== 'more' || !t.artist) return undefined;
    let alive = true;
    setMoreLoading(true);
    (async () => {
      try {
        const res = await cachedJson(
          '/api/searchMusic',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: t.artist, mode: 'search', maxResults: 25 }),
          },
          10 * 60 * 1000
        );
        const key = t.artist.toLowerCase().split(/[,&]| feat\.?| ft\.?/)[0].trim();
        const same = (res.tracks || []).filter(
          (x) =>
            x.videoId !== t.videoId &&
            x.videoId !== t.catalogId &&
            (x.artist || '').toLowerCase().includes(key)
        );
        if (alive) setMore(same);
      } catch {
        if (alive) setMore([]);
      }
      if (alive) setMoreLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [p.nowPlayingOpen, t?.videoId, t?.artist, tab]);

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
      return () => {
        active = false;
      };
    }

    setLyricLines([]);
    setLyricPlain('');
    setFailed(false);
    setLoadingL(true);

    const safety = setTimeout(() => {
      if (active) setLoadingL(false);
    }, 14000);

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
            writeJSON(LYRICS_CACHE_PREFIX + t.videoId, {
              lines: res.lines || [],
              plain: res.plain || '',
            });
          }
        }
      } catch {
        if (active) setFailed(true);
      }
      if (active) setLoadingL(false);
    })();

    return () => {
      active = false;
      clearTimeout(safety);
    };
  }, [p.nowPlayingOpen, t?.videoId, lyricsReady]);

  // ---------- FIXED DOWNLOAD ----------
  // Uses the real APIs:
  //   GET /api/resolve?artist=&title=  → { videoId: 'aud_…' | 'jam_…' | ytId, source }
  //   GET /api/stream?id=aud_…|jam_…  → 302 to the real audio file

  const handleDownload = async () => {
    if (!t || dlState === 'loading') return;
    setDlState('loading');
    setDlMsg('');
    const errors = [];
    try {
      const first = await resolveDownloadableId(t).catch(() => null);
      let free = first && first.kind === 'free' ? first : null;
      let ytId = first && first.kind === 'yt' ? first.id : null;

      // Track is itself a YouTube id: still look for a free (Audius/Jamendo) copy first
      if (!free && /^[A-Za-z0-9_-]{11}$/.test(t.videoId || '')) {
        const r = await resolveDownloadableId(t, { forceResolve: true }).catch(() => null);
        if (r && r.kind === 'free') free = r;
      }

      let blob = null;

      // 1) free source via our same-origin proxy
      if (free) {
        try { blob = await fetchAudioBlob(free); } catch (e) { errors.push(e.message || String(e)); }
      }

      // need a YouTube id for the remaining steps
      if (!blob && !ytId) {
        const alt = await resolveDownloadableId(t, { skipFree: true, forceResolve: true }).catch(() => null);
        if (alt && alt.kind === 'yt') ytId = alt.id;
        else errors.push('resolve: no YouTube match found');
      }

      // 2) Android app: download on the phone itself (its own IP is not blocked)
      if (!blob && ytId && isNative && deviceDownloadAvailable()) {
        try { blob = await downloadYoutubeOnDevice(ytId); } catch (e) { errors.push(`phone: ${e.message || e}`); }
      } else if (!blob && ytId && isNative) {
        errors.push('phone: native http missing');
      }

      // 3) our server (Cobalt)
      if (!blob && ytId) {
        try { blob = await fetchAudioBlob({ kind: 'yt', id: ytId }); } catch (e) { errors.push(e.message || String(e)); }
      }

      if (!blob) {
        throw new Error(`[${isNative ? 'app' : 'web'}] ${errors.length ? errors.join(' | ') : 'no source found for this song'}`);
      }

      if (isNative) {
        // The app WebView cannot save files, so keep it inside the app (Downloads page)
        await saveOffline(t, blob);
        setDlMsg('Saved in app — open Downloads to play offline');
      } else {
        const base = safeFilename(t.title, t.artist).replace(/\.m4a$/i, '');
        forceSaveBlob(blob, base + extFor(blob));
        try { await saveOffline(t, blob); } catch (e) { console.warn('saveOffline', e); }
        setDlMsg('Downloaded');
      }
      setDlState('done');
      setTimeout(() => { setDlState('idle'); setDlMsg(''); }, 3500);
    } catch (e) {
      console.warn('Download failed', e, errors);
      setDlMsg(`Couldn't download: ${String((e && e.message) || e).slice(0, 260)}`);
      setDlState('error');
      setTimeout(() => { setDlState('idle'); setDlMsg(''); }, 15000);
    }
  };


  if (!p.nowPlayingOpen || !t) return null;

  const saved = lib.savedIds && lib.savedIds.has(t.videoId);
  const hasSynced = lyricLines.length > 0;

  const dlTitle =
    dlState === 'error' ? dlMsg || 'Download failed — try again' : isNative ? 'Save offline in app' : 'Download';

  return (
    <div
      className={`fixed inset-x-0 top-0 z-[60] flex flex-col h-[100dvh] overflow-hidden ${
        closing ? 'np-out' : 'np-in'
      }`}
      style={{ height: '100dvh', background: '#000' }}
    >
      {/* solid base = album colour */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: color, transition: 'background-color 1000ms ease' }}
      />
      {/* slowly drifting colour glows while the song plays */}
      <div
        className="np-aurora"
        style={{ '--c': color }}
        data-playing={p.isPlaying ? 'true' : 'false'}
      >
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.92) 100%)',
        }}
      />

      <div
        className="relative flex flex-col h-full max-w-4xl mx-auto w-full px-4 sm:px-5 gap-3"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
        }}
      >
        <div className="flex items-center justify-between shrink-0">
          <button
            onClick={close}
            aria-label="Close"
            className="p-3 -m-1 rounded-full glass text-white/80 hover:text-white"
          >
            <ChevronDown size={22} />
          </button>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
            <Equalizer playing={p.isPlaying} /> Now Playing
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownload}
              aria-label="Download"
              disabled={dlState === 'loading'}
              className={`p-3 -m-1 rounded-full glass ${
                dlState === 'error'
                  ? 'text-red-400'
                  : 'text-white/70 hover:text-white'
              }`}
              title={dlTitle}
            >
              {dlState === 'loading' ? (
                <Loader2 size={20} className="animate-spin" />
              ) : dlState === 'done' ? (
                <Check size={20} className="text-green-400" />
              ) : (
                <Download size={20} />
              )}
            </button>
            <button
              onClick={() => lib.toggleSave(t)}
              aria-label="Like"
              className={`p-3 -m-1 rounded-full glass ${saved ? 'text-primary' : 'text-white/70'}`}
            >
              <Heart size={20} fill={saved ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {dlMsg && (dlState === 'error' || dlState === 'done') && (
          <div className="fixed left-1/2 -translate-x-1/2 top-20 z-[70] max-w-[90%] px-4 py-2 rounded-2xl bg-black/85 text-white text-xs text-center shadow-lg break-words">
            {dlMsg}
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 md:gap-5">
          <div className="md:w-1/2 flex md:flex-col items-center md:justify-center gap-3 shrink-0 md:shrink">
            <img
              src={t.thumbnail}
              alt=""
              className="w-16 h-16 md:w-48 md:h-48 rounded-xl md:rounded-2xl object-cover shadow-2xl shrink-0"
            />
            <div className="min-w-0 flex-1 md:flex-none md:text-center md:w-full">
              <div className="text-base md:text-lg font-bold truncate">{t.title}</div>
              <div className="text-white/60 truncate text-sm">{t.artist}</div>
              <div className="hidden md:block mt-1">
                <ShareButton track={t} title="Copy link" />
              </div>
            </div>
          </div>

          <div className="md:w-1/2 flex flex-col flex-1 min-h-0 rounded-2xl p-2 md:p-4">
            {/* Only Lyrics + More */}
            <div className="shrink-0 flex items-center sm:justify-center gap-2 pb-2 overflow-x-auto no-scrollbar">
              {[['lyrics', 'Lyrics'], ['more', 'More']].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                    tab === k ? 'bg-white text-black' : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'lyrics' ? (
              <>
                <LyricsView
                  lines={lyricLines}
                  plain={lyricPlain}
                  currentTime={p.currentTime}
                  loading={loadingL || !lyricsReady}
                  failed={failed}
                  offset={offset}
                  onSeek={p.seek}
                  size={lyricSize}
                />
                {hasSynced && (
                  <div className="shrink-0 flex items-center justify-center gap-3 pt-2 text-[11px] text-white/70">
                    <button onClick={() => nudge(-0.5)} className="px-3 py-1.5 rounded-full bg-white/15">
                      Lyrics later
                    </button>
                    <span className="tabular-nums w-12 text-center">
                      {offset > 0 ? '+' : ''}
                      {offset.toFixed(1)}s
                    </span>
                    <button onClick={() => nudge(0.5)} className="px-3 py-1.5 rounded-full bg-white/15">
                      Lyrics earlier
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar overscroll-contain space-y-1">
                {moreLoading && (
                  <div className="flex items-center gap-2 text-white/70 text-sm p-3">
                    <Loader2 size={16} className="animate-spin" /> Finding songs…
                  </div>
                )}
                {!moreLoading && more.length > 0 && t.artist && (
                  <div className="text-xs uppercase tracking-wide text-white/60 px-2 pb-1">
                    More by {t.artist}
                  </div>
                )}
                {!moreLoading && more.length === 0 && (
                  <div className="text-white/70 text-sm p-3">No other songs found for this artist.</div>
                )}
                {more.map((m) => (
                  <button
                    key={m.videoId}
                    onClick={() =>
                      p.playTrack(m, [m, ...more.filter((x) => x.videoId !== m.videoId)])
                    }
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 text-left"
                  >
                    <img src={m.thumbnail} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">{m.title}</div>
                      <div className="truncate text-xs text-white/70">{m.artist}</div>
                    </div>
                    <Play size={16} className="text-white/70 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-white/50">
            <span className="w-9 text-right tabular-nums">{fmt(p.currentTime)}</span>
            <input
              type="range"
              min={0}
              max={p.duration || 0}
              step={0.1}
              value={Math.min(p.currentTime, p.duration || 0)}
              onChange={(e) => p.seek(Number(e.target.value))}
              className="flex-1 h-8"
              aria-label="Seek"
            />
            <span className="w-9 tabular-nums">{fmt(p.duration)}</span>
          </div>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={p.toggleShuffle}
              aria-label="Shuffle"
              className={`p-2 ${p.shuffle ? 'text-primary' : 'text-white/70'}`}
            >
              <Shuffle size={20} />
            </button>
            <button onClick={p.prev} aria-label="Previous" className="p-2 text-white/80">
              <SkipBack size={26} />
            </button>
            <button
              onClick={p.togglePlay}
              aria-label="Play/Pause"
              className="bg-primary text-primary-foreground rounded-full p-4 shadow-lg active:scale-95 transition"
            >
              {p.isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
            </button>
            <button onClick={p.next} aria-label="Next" className="p-2 text-white/80">
              <SkipForward size={26} />
            </button>
            <button
              onClick={p.toggleRepeat}
              aria-label="Repeat"
              className={`p-2 ${p.repeat ? 'text-primary' : 'text-white/70'}`}
            >
              <Repeat size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
