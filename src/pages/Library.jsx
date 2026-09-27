import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMusicLibrary } from '@/lib/useMusicLibrary';
import TrackList from '@/components/TrackList';
import { usePlayer } from '@/lib/PlayerContext';
import { Heart, ListMusic, Plus, Trash2, Play } from 'lucide-react';

export default function Library() {
  const lib = useMusicLibrary();
  const player = usePlayer();
  const [tab, setTab] = useState('liked');
  const [newName, setNewName] = useState('');

  const likedTracks = lib.saved.map((s) => ({ videoId: s.videoId, title: s.title, artist: s.artist, thumbnail: s.thumbnail }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Your Library</h1>

      <div className="flex gap-2">
        <button onClick={() => setTab('liked')} className={`px-4 py-2 rounded-xl text-sm glass ${tab === 'liked' ? 'text-primary border-primary/40' : 'text-white/70'}`}>Liked Songs</button>
        <button onClick={() => setTab('playlists')} className={`px-4 py-2 rounded-xl text-sm glass ${tab === 'playlists' ? 'text-primary border-primary/40' : 'text-white/70'}`}>Playlists</button>
      </div>

      {tab === 'liked' && (
        <TrackList
          tracks={likedTracks}
          savedIds={lib.savedIds}
          onToggleSave={lib.toggleSave}
          emptyText="No liked songs yet. Tap the heart on any track."
        />
      )}

      {tab === 'playlists' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New playlist name" className="glass rounded-xl px-3 py-2 text-sm outline-none border border-white/10 flex-1 max-w-xs" />
            <button onClick={async () => { await lib.createPlaylist(newName); setNewName(''); }} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-sm font-medium"><Plus size={16} /> Create</button>
          </div>

          {lib.playlists.length === 0 ? (
            <div className="text-white/40 text-sm py-10 text-center glass rounded-2xl">No playlists yet — create one above.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lib.playlists.map((pl) => (
                <Link to={`/playlist/${pl.id}`} key={pl.id} className="glass glass-hover rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center text-primary"><ListMusic size={24} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{pl.name}</div>
                    <div className="text-xs text-white/50">{(pl.tracks || []).length} tracks</div>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); if ((pl.tracks || []).length) player.playTrack(pl.tracks[0], pl.tracks); }} className="p-2 rounded-full bg-primary text-primary-foreground"><Play size={16} /></button>
                  <button onClick={async (e) => { e.preventDefault(); await lib.deletePlaylist(pl.id); }} className="p-2 rounded-lg text-white/40 hover:text-destructive"><Trash2 size={16} /></button>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
