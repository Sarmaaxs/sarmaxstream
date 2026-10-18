import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '@/lib/PlayerContext';
import {
  listOffline,
  removeOffline,
  getOfflineUrl,
  formatBytes,
} from '@/lib/offlineDownloads';
import { Download, Trash2, Play, HardDrive, ArrowLeft } from 'lucide-react';

export default function Downloads() {
  const player = usePlayer();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await listOffline();
    setItems(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const play = async (item) => {
    setBusy(item.videoId);
    try {
      const url = await getOfflineUrl(item.videoId);
      if (!url) throw new Error('missing blob');
      // Mark as offline so PlayerContext uses the blob URL via audio engine
      const track = {
        videoId: item.videoId,
        title: item.title,
        artist: item.artist,
        thumbnail: item.thumbnail,
        duration: item.duration,
        _offlineUrl: url,
      };
      player.playTrack(track, [track]);
    } catch (e) {
      console.warn('offline play failed', e);
    }
    setBusy(null);
  };

  const remove = async (videoId) => {
    setBusy(videoId);
    try {
      await removeOffline(videoId);
      setItems((prev) => prev.filter((x) => x.videoId !== videoId));
    } catch (e) {
      console.warn('remove offline failed', e);
    }
    setBusy(null);
  };

  const totalBytes = items.reduce((s, x) => s + (x.size || 0), 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-1">
      <div className="flex items-center gap-3">
        <Link to="/music/library" className="p-2 rounded-full glass text-white/70 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <HardDrive size={26} className="text-primary" />
            Downloads
          </h1>
          <p className="text-sm text-white/50 mt-0.5">
            {items.length === 0
              ? 'Tracks you save offline appear here'
              : `${items.length} track${items.length === 1 ? '' : 's'} · ${formatBytes(totalBytes)}`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-white/40 text-sm py-16 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center space-y-3">
          <Download size={36} className="mx-auto text-white/30" />
          <p className="text-white/60 text-sm">
            No offline tracks yet. Open any song → tap the download icon.
          </p>
          <p className="text-white/40 text-xs">
            In the app the file stays inside Sarmaxstream. On the website it also saves to your phone.
          </p>
          <Link
            to="/music"
            className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
          >
            Browse music
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.videoId}
              className="glass glass-hover rounded-2xl p-3 flex items-center gap-3"
            >
              <button
                onClick={() => play(item)}
                disabled={busy === item.videoId}
                className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-white/5"
              >
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary">
                    <Play size={22} />
                  </div>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition">
                  <Play size={20} className="text-white" fill="white" />
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{item.title || 'Unknown'}</div>
                <div className="text-xs text-white/50 truncate">
                  {item.artist || 'Unknown artist'}
                  {item.size ? ` · ${formatBytes(item.size)}` : ''}
                </div>
              </div>
              <button
                onClick={() => play(item)}
                disabled={busy === item.videoId}
                className="p-2.5 rounded-full bg-primary text-primary-foreground shrink-0"
                title="Play offline"
              >
                <Play size={16} fill="currentColor" />
              </button>
              <button
                onClick={() => remove(item.videoId)}
                disabled={busy === item.videoId}
                className="p-2.5 rounded-lg text-white/40 hover:text-destructive shrink-0"
                title="Remove from device"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
