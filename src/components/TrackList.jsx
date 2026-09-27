import React from 'react';
import { Play, Pause, Heart, Clock } from 'lucide-react';
import { usePlayer } from '@/lib/PlayerContext';
import AddToPlaylistMenu from '@/components/AddToPlaylistMenu';
import ShareButton from '@/components/ShareButton';

function parseDur(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = +(m[1] || 0), mi = +(m[2] || 0), s = +(m[3] || 0);
  const pad = (n) => n.toString().padStart(2, '0');
  return h ? `${h}:${pad(mi)}:${pad(s)}` : `${mi}:${pad(s)}`;
}

export default function TrackList({ tracks, savedIds, playlists, onToggleSave, onCreatePlaylist, onAddToPlaylist, emptyText = 'Nothing here yet.' }) {
  const player = usePlayer();
  if (!tracks.length) return <div className="text-white/40 text-sm py-10 text-center glass rounded-2xl">{emptyText}</div>;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {tracks.map((t, i) => {
        const playing = player.current && player.current.videoId === t.videoId;
        return (
          <div key={t.videoId + i} className={`group flex items-center gap-3 px-3 py-2.5 ${i % 2 ? '' : 'bg-white/[0.02]'} ${playing ? 'bg-primary/10' : ''}`}>
            <div className="w-6 text-center text-xs text-white/40">{i + 1}</div>
            <button onClick={() => (playing ? player.togglePlay() : player.playTrack(t, tracks))} className="relative shrink-0">
              <img src={t.thumbnail} alt="" className="w-11 h-11 rounded-lg object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition">
                {playing && player.isPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white" />}
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm font-medium ${playing ? 'text-primary' : 'text-white'}`}>{t.title}</div>
              <div className="truncate text-xs text-white/50">{t.artist}</div>
            </div>
            <div className="hidden sm:block text-xs text-white/40 w-12 text-right">{parseDur(t.duration)}</div>
            {onAddToPlaylist && (
              <AddToPlaylistMenu track={t} playlists={playlists || []} onCreate={onCreatePlaylist} onAdd={onAddToPlaylist} />
            )}
            {onToggleSave && (
              <button onClick={() => onToggleSave(t)} className={`p-1.5 rounded-lg hover:bg-white/5 ${savedIds && savedIds.has(t.videoId) ? 'text-primary' : 'text-white/40 hover:text-white'}`} title="Save to Liked">
                <Heart size={17} fill={savedIds && savedIds.has(t.videoId) ? 'currentColor' : 'none'} />
              </button>
            )}
            <ShareButton track={t} />
          </div>
        );
      })}
    </div>
  );
}
