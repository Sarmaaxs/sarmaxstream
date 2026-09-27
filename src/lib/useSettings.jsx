import React, { createContext, useContext, useEffect, useState } from 'react';

const SettingsContext = createContext(null);

function read(key, def) {
  const v = localStorage.getItem(key);
  if (v === null) return def;
  try { return JSON.parse(v); } catch { return v; }
}

export function SettingsProvider({ children }) {
  const [autoplay, setAutoplay] = useState(() => read('sarmax_autoplay', true));
  const [crossfade, setCrossfade] = useState(() => read('sarmax_crossfade', 0));
  const [gapless, setGapless] = useState(() => read('sarmax_gapless', true));
  const [quality, setQuality] = useState(() => read('sarmax_quality', 'auto'));
  const [notifications, setNotifications] = useState(() =>
    read('sarmax_notifications', { releases: true, playlists: true, product: false })
  );
  const [playbackSpeed, setPlaybackSpeed] = useState(() => read('sarmax_speed', 1));
  const [normalization, setNormalization] = useState(() => read('sarmax_norm', false));
  const [sleepTimer, setSleepTimer] = useState(() => read('sarmax_sleep', 0));

  useEffect(() => { localStorage.setItem('sarmax_autoplay', JSON.stringify(autoplay)); }, [autoplay]);
  useEffect(() => { localStorage.setItem('sarmax_crossfade', JSON.stringify(crossfade)); }, [crossfade]);
  useEffect(() => { localStorage.setItem('sarmax_gapless', JSON.stringify(gapless)); }, [gapless]);
  useEffect(() => { localStorage.setItem('sarmax_quality', JSON.stringify(quality)); }, [quality]);
  useEffect(() => { localStorage.setItem('sarmax_notifications', JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem('sarmax_speed', JSON.stringify(playbackSpeed)); }, [playbackSpeed]);
  useEffect(() => { localStorage.setItem('sarmax_norm', JSON.stringify(normalization)); }, [normalization]);
  useEffect(() => { localStorage.setItem('sarmax_sleep', JSON.stringify(sleepTimer)); }, [sleepTimer]);

  const setNotification = (key, val) => setNotifications((n) => ({ ...n, [key]: val }));

  return (
    <SettingsContext.Provider
      value={{ autoplay, setAutoplay, crossfade, setCrossfade, gapless, setGapless, quality, setQuality, notifications, setNotification, playbackSpeed, setPlaybackSpeed, normalization, setNormalization, sleepTimer, setSleepTimer }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    return {
      autoplay: true, setAutoplay: () => {},
      crossfade: 0, setCrossfade: () => {},
      gapless: true, setGapless: () => {},
      quality: 'auto', setQuality: () => {},
      notifications: { releases: true, playlists: true, product: false },
      setNotification: () => {},
      playbackSpeed: 1, setPlaybackSpeed: () => {},
      normalization: false, setNormalization: () => {},
      sleepTimer: 0, setSleepTimer: () => {},
    };
  }
  return ctx;
}
