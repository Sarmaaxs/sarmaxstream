import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from '@/lib/useSettings';

const PlayerContext = createContext(null);

const STATE_KEY = 'sarmax_player_v1';

function loadSaved() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return {};
    const d = JSON.parse(raw);
    return d && typeof d === 'object' ? d : {};
  } catch { return {}; }
}

const QUALITY_MAP = { auto: 'auto', low: 'small', normal: 'medium', high: 'hd720' };

export function PlayerProvider({ children }) {
  const { autoplay, crossfade, gapless, quality, playbackSpeed, normalization, sleepTimer } = useSettings();
  const savedRef = useRef(null);
  if (savedRef.current === null) savedRef.current = loadSaved();
  const sv = savedRef.current;
  const [current, setCurrent] = useState(sv.current && sv.current.videoId ? sv.current : null);
  const [queue, setQueue] = useState(Array.isArray(sv.queue) ? sv.queue : []);
  const [index, setIndex] = useState(typeof sv.index === 'number' ? sv.index : -1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(sv.current && sv.time ? sv.time : 0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(typeof sv.volume === 'number' ? sv.volume : 80);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState(!!sv.repeat);
  const [shuffle, setShuffle] = useState(!!sv.shuffle);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem('sarmax_recent') || '[]'); } catch { return []; } });

  const playerRef = useRef(null);
  const queueRef = useRef(Array.isArray(sv.queue) ? sv.queue : []);
  const indexRef = useRef(typeof sv.index === 'number' ? sv.index : -1);
  const repeatRef = useRef(!!sv.repeat);
  const shuffleRef = useRef(!!sv.shuffle);
  const errCountRef = useRef(0);
  const loadedRef = useRef(false); // true once the user (or a link) chose a track this visit
  const restoreRef = useRef(sv.current && sv.current.videoId ? { videoId: sv.current.videoId, time: sv.time || 0 } : null);
  const currentRef = useRef(sv.current && sv.current.videoId ? sv.current : null);
  const timeRef = useRef(sv.time || 0);
  const autoplayRef = useRef(autoplay);
  const crossfadeRef = useRef(crossfade);
  const gaplessRef = useRef(gapless);
  const qualityRef = useRef(quality);
  const volumeRef = useRef(typeof sv.volume === 'number' ? sv.volume : 80);
  const speedRef = useRef(playbackSpeed);
  const normRef = useRef(normalization);
  const sleepRef = useRef(sleepTimer);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { autoplayRef.current = autoplay; }, [autoplay]);
  useEffect(() => { crossfadeRef.current = crossfade; }, [crossfade]);
  useEffect(() => { gaplessRef.current = gapless; }, [gapless]);
  useEffect(() => { qualityRef.current = quality; applyQuality(); }, [quality]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { normRef.current = normalization; }, [normalization]);
  useEffect(() => { sleepRef.current = sleepTimer; }, [sleepTimer]);
  useEffect(() => { try { localStorage.setItem('sarmax_recent', JSON.stringify(recent)); } catch {} }, [recent]);

  // Remember what was playing so it's still there when the user comes back.
  const persist = useCallback(() => {
    try {
      const cur = currentRef.current;
      localStorage.setItem(STATE_KEY, JSON.stringify({
        current: cur ? { videoId: cur.videoId, title: cur.title, artist: cur.artist, thumbnail: cur.thumbnail, duration: cur.duration || '' } : null,
        queue: (queueRef.current || []).slice(0, 60).map((t) => ({ videoId: t.videoId, title: t.title, artist: t.artist, thumbnail: t.thumbnail, duration: t.duration || '' })),
        index: indexRef.current,
        time: timeRef.current || 0,
        volume: volumeRef.current,
        repeat: repeatRef.current,
        shuffle: shuffleRef.current,
      }));
    } catch {}
  }, []);
  useEffect(() => { currentRef.current = current; persist(); }, [current, queue, index, volume, repeat, shuffle, persist]);
  useEffect(() => { timeRef.current = currentTime; }, [currentTime]);
  useEffect(() => {
    const id = setInterval(persist, 5000);
    const onHide = () => persist();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => { clearInterval(id); window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide); };
  }, [persist]);

  const applySpeed = useCallback(() => {
    if (playerRef.current && playerRef.current.setPlaybackRate) {
      try { playerRef.current.setPlaybackRate(speedRef.current); } catch {}
    }
  }, []);

  useEffect(() => { speedRef.current = playbackSpeed; applySpeed(); }, [playbackSpeed, applySpeed]);

  const applyQuality = useCallback(() => {
    if (playerRef.current && playerRef.current.setPlaybackQuality) {
      try { playerRef.current.setPlaybackQuality(QUALITY_MAP[qualityRef.current] || 'auto'); } catch {}
    }
  }, []);

  const restoreVolume = useCallback(() => {
    if (playerRef.current && playerRef.current.setVolume) {
      try { playerRef.current.setVolume(volumeRef.current); } catch {}
    }
  }, []);

  const playAt = useCallback((i) => {
    const q = queueRef.current;
    if (i < 0 || i >= q.length) return;
    const track = q[i];
    loadedRef.current = true;
    restoreRef.current = null;
    errCountRef.current = 0;
    timeRef.current = 0;
    currentRef.current = track;
    setCurrentTime(0);
    setDuration(0);
    setIndex(i);
    setCurrent(track);
    setRecent((r) => {
      const f = r.filter((x) => x.videoId !== track.videoId);
      return [{ videoId: track.videoId, title: track.title, artist: track.artist, thumbnail: track.thumbnail }, ...f].slice(0, 30);
    });
    if (playerRef.current && playerRef.current.loadVideoById) {
      playerRef.current.loadVideoById(track.videoId);
      setTimeout(() => { applyQuality(); applySpeed(); }, 400);
    }
  }, [applyQuality]);

  const next = useCallback(() => {
    const q = queueRef.current;
    if (!q.length) return;
    let i = indexRef.current;
    if (shuffleRef.current && q.length > 1) {
      let r; do { r = Math.floor(Math.random() * q.length); } while (r === i);
      playAt(r);
      return;
    }
    i = i + 1;
    if (i >= q.length) i = 0;
    playAt(i);
  }, [playAt]);

  const prev = useCallback(() => {
    const q = queueRef.current;
    if (!q.length) return;
    let i = indexRef.current - 1;
    if (i < 0) i = q.length - 1;
    playAt(i);
  }, [playAt]);

  useEffect(() => {
    function initPlayer() {
      if (!window.YT || !window.YT.Player) return;
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player('yt-hidden-player', {
        height: '1',
        width: '1',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: (e) => {
            setIsReady(true);
            try { e.target.setVolume(volumeRef.current); applyQuality(); applySpeed(); } catch {}
            const r = restoreRef.current;
            if (r && !loadedRef.current) {
              try { e.target.cueVideoById({ videoId: r.videoId, startSeconds: r.time || 0 }); } catch {}
            }
          },
          onStateChange: (e) => {
            const YTS = window.YT.PlayerState;
            if (e.data === YTS.PLAYING) {
              setIsPlaying(true);
              errCountRef.current = 0;
              restoreVolume();
              applyQuality();
            } else if (e.data === YTS.PAUSED) {
              setIsPlaying(false);
            } else if (e.data === YTS.ENDED) {
              if (repeatRef.current) {
                try { playerRef.current.seekTo(0); playerRef.current.playVideo(); } catch {}
              } else if (autoplayRef.current) {
                if (gaplessRef.current) next();
                else setTimeout(() => next(), 250);
              } else {
                setIsPlaying(false);
              }
            }
          },
          onError: () => {
            // Some videos can't be embedded. Skip a few, but never loop through the whole queue.
            errCountRef.current += 1;
            if (errCountRef.current <= 3 && queueRef.current.length > 1) next();
            else setIsPlaying(false);
          }
        }
      });
    }
    if (window.YT && window.YT.Player) { initPlayer(); }
    else if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }
    const t = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        try {
          const ct = playerRef.current.getCurrentTime() || 0;
          const d = playerRef.current.getDuration() || 0;
          setCurrentTime(ct);
          setDuration(d);
          const cf = crossfadeRef.current;
          if (cf > 0 && autoplayRef.current && !repeatRef.current && d > 0 && !muted && !normRef.current) {
            const rem = d - ct;
            if (rem > 0 && rem <= cf && playerRef.current.setVolume) {
              const frac = Math.max(0, rem / cf);
              playerRef.current.setVolume(Math.round(volumeRef.current * frac));
            }
          }
        } catch {}
      }
    }, 250);
    return () => clearInterval(t);
  }, [next, applyQuality, restoreVolume, muted]);

  const playTrack = useCallback((track, list) => {
    const q = list && list.length ? list : [track];
    setQueue(q);
    queueRef.current = q;
    let idx = q.findIndex((t) => t.videoId === track.videoId);
    if (idx < 0) idx = 0;
    playAt(idx);
  }, [playAt]);

  // Load a track WITHOUT autoplaying (phones block autoplay without a tap).
  const cueTrack = useCallback((track) => {
    loadedRef.current = true;
    restoreRef.current = null;
    setQueue([track]);
    queueRef.current = [track];
    setIndex(0);
    setCurrent(track);
    currentRef.current = track;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    try { playerRef.current?.cueVideoById(track.videoId); } catch {}
  }, []);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    try {
      const st = playerRef.current.getPlayerState ? playerRef.current.getPlayerState() : null;
      const playingNow = st === 1 || st === 3; // playing or buffering
      if (playingNow) playerRef.current.pauseVideo();
      else playerRef.current.playVideo();
    } catch {}
  }, []);

  const seek = useCallback((sec) => {
    if (playerRef.current && playerRef.current.seekTo) {
      try { playerRef.current.seekTo(sec, true); setCurrentTime(sec); } catch {}
    }
  }, []);

  const setVol = useCallback((v) => {
    setVolume(v);
    volumeRef.current = v;
    if (playerRef.current && playerRef.current.setVolume) {
      try { playerRef.current.setVolume(v); if (v > 0) setMuted(false); } catch {}
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (muted) { playerRef.current.unMute(); setMuted(false); }
      else { playerRef.current.mute(); setMuted(true); }
    } catch {}
  }, [muted]);

  const toggleRepeat = useCallback(() => setRepeat((r) => !r), []);
  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);
  const openNowPlaying = useCallback(() => setNowPlayingOpen(true), []);
  const closeNowPlaying = useCallback(() => setNowPlayingOpen(false), []);

  useEffect(() => {
    if (!sleepTimer || sleepTimer <= 0) return;
    const id = setTimeout(() => {
      try { if (playerRef.current) playerRef.current.pauseVideo(); } catch {}
      setIsPlaying(false);
    }, sleepTimer * 60000);
    return () => clearTimeout(id);
  }, [sleepTimer]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => { try { playerRef.current?.playVideo?.(); } catch {} });
      navigator.mediaSession.setActionHandler('pause', () => { try { playerRef.current?.pauseVideo?.(); } catch {} });
      navigator.mediaSession.setActionHandler('previoustrack', () => prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
    } catch {}
    if (current && window.MediaMetadata) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: current.title || '',
        artist: current.artist || '',
        album: 'Sarmax Stream',
        artwork: current.thumbnail ? [{ src: current.thumbnail, sizes: '480x480', type: 'image/jpeg' }] : []
      });
    }
    try { navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'; } catch {}
  }, [current, isPlaying, prev, next]);

  const value = {
    current, isPlaying, isReady, currentTime, duration, volume, muted, repeat, shuffle, queue, index,
    nowPlayingOpen, openNowPlaying, closeNowPlaying, recent,
    playTrack, cueTrack, togglePlay, next, prev, seek, setVolume: setVol, toggleMute, toggleRepeat, toggleShuffle
  };

  return (
    <PlayerContext.Provider value={value}>
      <div aria-hidden="true" style={{ position: 'fixed', bottom: 0, right: 0, width: 2, height: 2, overflow: 'hidden', opacity: 0.01, pointerEvents: 'none', zIndex: -1 }}>
        <div id="yt-hidden-player" />
      </div>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
