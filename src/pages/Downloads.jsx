import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Download, Music2, Play, RefreshCw, Trash2, X } from 'lucide-react';
import { usePlayer } from '@/lib/PlayerContext';
import { useDownloads, dismissDownload, retryDownload } from '@/lib/downloadManager';
import { getOfflineUrl, listOffline, removeOffline } from '@/lib/offlineDownloads';

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusIcon(status) {
  if (status === 'done') return <CheckCircle2 size={17} className="text-primary" />;
  if (status === 'error') return <AlertCircle size={17} className="text-red-400" />;
  if (status === 'saving') return <Download size={17} className="text-primary" />;
  return <Clock3 size={17} className="text-white/50" />;
}

export default function Downloads() {
  const player = usePlayer();
  const jobs = useDownloads();
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState('');

  const refreshSaved = useCallback(async () => {
    setLoading(true);
    setSaved(await listOffline());
    setLoading(false);
  }, []);

  useEffect(() => { refreshSaved(); }, [refreshSaved]);

  const playSaved = async (item) => {
    setPlayingId(item.videoId);
    const url = await getOfflineUrl(item.videoId);
    if (!url) {
      await refreshSaved();
      setPlayingId('');
      return;
    }
    const track = {
      videoId: item.videoId,
      title: item.title || 'Unknown track',
      artist: item.artist || '',
      thumbnail: item.thumbnail || '',
      duration: item.duration || '',
      _offlineUrl: url,
    };
    player.playTrack(track, [track]);
    setPlayingId('');
  };

  const removeSaved = async (videoId) => {
    await removeOffline(videoId, { revokeUrl: player.current?.videoId !== videoId });
    await refreshSaved();
  };

  return (
    <div className="space-y-7">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center"><Download size={23} /></div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Downloads</h1>
          <p className="text-sm text-white/50 mt-1">Music saved on this device for offline listening</p>
        </div>
        <button onClick={refreshSaved} className="ml-auto p-2 rounded-xl glass text-white/60 hover:text-white" aria-label="Refresh downloads"><RefreshCw size={17} /></button>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Saved offline · {saved.length}</h2>
        {loading ? (
          <div className="rounded-2xl glass p-8 text-center text-sm text-white/45">Loading saved music…</div>
        ) : saved.length === 0 ? (
          <div className="rounded-2xl glass border border-white/10 p-8 text-center">
            <Music2 size={30} className="mx-auto text-white/25" />
            <p className="mt-3 font-medium">No music saved offline yet</p>
            <p className="mt-1 text-sm text-white/45">Use the download icon on a song to save it here.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.025] overflow-hidden">
            {saved.map((item) => (
              <div key={item.videoId} className="flex items-center gap-3 p-3 sm:p-4">
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                  {item.thumbnail ? <img src={item.thumbnail} alt="" className="w-full h-full object-cover" /> : <Music2 size={18} className="text-white/35" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{item.title}</div>
                  <div className="text-xs text-white/45 truncate">{item.artist || 'Unknown artist'} · {formatSize(item.size)}</div>
                </div>
                <button onClick={() => playSaved(item)} disabled={playingId === item.videoId} className="p-2.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50" aria-label={`Play ${item.title}`}>
                  <Play size={16} fill="currentColor" />
                </button>
                <button onClick={() => removeSaved(item.videoId)} className="p-2 rounded-lg text-white/40 hover:text-red-300" aria-label={`Remove ${item.title}`}><Trash2 size={17} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Recent download activity</h2>
        {jobs.length === 0 ? (
          <div className="rounded-2xl glass p-6 text-center text-sm text-white/45">No recent download activity.</div>
        ) : (
          <div className="space-y-2">
            {jobs.slice().reverse().map((job) => {
              const pct = job.total > 0 ? Math.min(100, Math.round((job.loaded / job.total) * 100)) : 0;
              return (
                <div key={job.key} className="rounded-2xl glass border border-white/10 p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    {statusIcon(job.status)}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{job.title}</div>
                      <div className="text-xs text-white/45 truncate">{job.artist || job.message || job.status}</div>
                    </div>
                    <span className="text-xs text-white/50 capitalize">{job.status}</span>
                    {job.status === 'error' && <button onClick={() => retryDownload(job.key)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Retry download"><RefreshCw size={16} /></button>}
                    <button onClick={() => dismissDownload(job.key)} className="p-2 rounded-lg text-white/40 hover:text-white" aria-label="Dismiss download"><X size={16} /></button>
                  </div>
                  {job.total > 0 && job.status !== 'done' && (
                    <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
                  )}
                  {job.error && <p className="mt-2 text-xs text-red-300/80">{job.error}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
