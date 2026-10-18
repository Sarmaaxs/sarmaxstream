import React from 'react';
import { useParams, Link } from 'react-router-dom';
import TrackList from '@/components/TrackList';
import { useMusicLibrary } from '@/lib/useMusicLibrary';
import { usePlayer } from '@/lib/PlayerContext';
import { ArrowLeft, Play, Loader2 } from 'lucide-react';

export default function PlaylistView() {
  const { id } = useParams();
  const lib = useMusicLibrary();
  const player = usePlayer();

  // useMusicLibrary already loads every playlist (with its tracks) via
  // Supabase on mount, so no separate fetch-by-id call is needed here —
  // this replaces the old base44.entities.Playlist.get(id) round trip.
  const playlist = lib.playlists.find((p) => p.id === id) || null;
  const loading = lib.loading;

  const tracks = (playlist && Array.isArray(playlist.tracks)) ? playlist.tracks : [];

  if (loading) return <div className="flex justify-center py-20 text-white/50"><Loader2 className="animate-spin" /></div>;
  if (!playlist) return <div className="text-white/50">Playlist not found.</div>;

  return (
    <div className="space-y-6">
      <Link to="/music/library" className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white"><ArrowLeft size={16} /> Back to Library</Link>
      <div className="flex items-end gap-4">
        <div className="w-24 h-24 rounded-2xl bg-primary/15 flex items-center justify-center text-primary text-4xl font-bold">{playlist.name.charAt(0).toUpperCase()}</div>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-white/50">Playlist</div>
          <h1 className="text-2xl md:text-3xl font-bold">{playlist.name}</h1>
          <div className="text-white/50 text-sm">{tracks.length} tracks</div>
        </div>
        {tracks.length > 0 && (
          <button onClick={() => player.playTrack(tracks[0], tracks)} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full font-medium"><Play size={18} /> Play</button>
        )}
      </div>
      <TrackList
        tracks={tracks}
        savedIds={lib.savedIds}
        onToggleSave={lib.toggleSave}
        emptyText="This playlist is empty."
      />
    </div>
  );
}
