import React from 'react';
import { Play, Pause, Heart } from 'lucide-react';
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

// Material 3 style list (Soundbound look): flat rows, big rounded artwork,
// the playing row is highlighted with a tonal container.
export default function TrackList({ tracks, savedIds, playlists, onToggleSave, onCreatePlaylist, onAddToPlaylist, emptyText = 'Nothing here yet.' }) {
  const player = usePlayer();
  if (!tracks.length) return <div className="text-white/40 text-sm py-10 text-center glass rounded-3xl">{emptyText}</div>;

  return (
    <div className="space-y-1">
      {tracks.map((t, i) => {
        const playing = player.current && (player.current.videoId === t.videoId || player.current.catalogId === t.videoId);
        return (
          <div
            key={t.videoId + i}
            className={`group flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors ${playing ? 'bg-secondary' : 'hover:bg-card active:bg-card'}`}
          >
            <div className="hidden sm:block w-6 text-center text-xs text-white/40">{i + 1}</div>
            <button onClick={() => (playing ? player.togglePlay() : player.playTrack(t, tracks))} className="relative shrink-0">
              <img src={t.thumbnail} alt="" className="w-12 h-12 rounded-xl object-cover" />
              <span className={`absolute inset-0 flex items-center justify-center bg-black/45 rounded-xl transition ${playing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {playing && player.isPlaying ? <Pause size={18} className="text-white" fill="currentColor" /> : <Play size={18} className="text-white" fill="currentColor" />}
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <div className={`truncate text-[15px] font-medium ${playing ? 'text-primary' : 'text-foreground'}`}>{t.title}</div>
              <div className="truncate text-xs text-muted-foreground">{t.artist}{t.license ? <span className="text-white/30"> · {t.license}</span> : null}</div>
            </div>
            <div className="hidden sm:block text-xs text-white/40 w-12 text-right">{parseDur(t.duration)}</div>
            {onAddToPlaylist && (
              <AddToPlaylistMenu track={t} playlists={playlists || []} onCreate={onCreatePlaylist} onAdd={onAddToPlaylist} />
            )}
            {onToggleSave && (
              <button onClick={() => onToggleSave(t)} className={`p-2 rounded-full hover:bg-white/5 ${savedIds && savedIds.has(t.videoId) ? 'text-primary' : 'text-white/40 hover:text-white'}`} title="Save to Liked">
                <Heart size={18} fill={savedIds && savedIds.has(t.videoId) ? 'currentColor' : 'none'} />
              </button>
            )}
            <ShareButton track={t} />
          </div>
        );
      })}
    </div>
  );
}
