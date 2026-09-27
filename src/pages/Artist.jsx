import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
// base44 removed — using fetch to /api/searchMusic instead
import SearchBar from '@/components/SearchBar';
import TrackGrid from '@/components/TrackGrid';
import { useMusicLibrary } from '@/lib/useMusicLibrary';
import { usePlayer } from '@/lib/PlayerContext';
import { Loader2, Play } from 'lucide-react';

export default function Artist() {
  const { channelId } = useParams();
  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const lib = useMusicLibrary();
  const player = usePlayer();

  useEffect(() => {
    if (!channelId) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/searchMusic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'artistSongs', channelId, maxResults: 50 }) }).then(r => r.json());
        setTracks(res.tracks || []);
        setArtist(res.artist || null);
      } catch {}
      setLoading(false);
    })();
  }, [channelId]);

  const name = artist?.title || (tracks[0]?.artist || 'Artist');

  return (
    <div className="space-y-6">
      <SearchBar />
      {loading ? (
        <div className="flex justify-center py-16 text-white/50"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          <div className="flex items-end gap-4">
            <img src={artist?.thumbnail || tracks[0]?.thumbnail || ''} alt="" className="w-24 h-24 rounded-full object-cover shadow-lg" />
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wide text-white/50">Artist</div>
              <h1 className="text-2xl md:text-4xl font-bold truncate">{name}</h1>

            </div>
            {tracks.length > 0 && (
              <button onClick={() => player.playTrack(tracks[0], tracks)} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full font-medium shrink-0"><Play size={18} /> Play</button>
            )}
          </div>
          <TrackGrid
            tracks={tracks}
            savedIds={lib.savedIds}
            onToggleSave={lib.toggleSave}
            emptyText="No songs found for this artist."
          />
        </>
      )}
    </div>
  );
}
