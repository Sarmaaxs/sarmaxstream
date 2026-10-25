import { cachedJson } from '@/lib/cache';
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import SearchBar from '@/components/SearchBar';
import TrackList from '@/components/TrackList';
import { useMusicLibrary } from '@/lib/useMusicLibrary';
import { Loader2 } from 'lucide-react';

import { getPrefs } from '@/lib/prefs';

const RECENT_KEY = 'sarmax_recent_searches';

function saveRecentSearch(q) {
  if (!getPrefs().saveSearchHistory) return;
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const next = [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

async function post(body) {
  if (DEBUG) {
    const r = await fetch('/api/searchMusic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, debug: true }) });
    return r.json();
  }
  return cachedJson('/api/searchMusic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 10 * 60 * 1000);
}

export default function SearchResults() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const lib = useMusicLibrary();
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [why, setWhy] = useState(null);
  const [free, setFree] = useState([]);

  useEffect(() => {
    if (!q) { setTracks([]); setArtists([]); setFree([]); setLoading(false); return undefined; }
    let active = true;
    setLoading(true);
    saveRecentSearch(q);
    (async () => {
      // Songs are the main result; artists are a small extra row, and only real ones.
      const [songs, fr] = await Promise.all([
        post({ query: q, mode: 'search', maxResults: 25 }).catch(() => ({})),
        post({ query: q, mode: 'free', maxResults: 12 }).catch(() => ({})),
      ]);
      const arts = {};
      if (!active) return;
      setTracks(songs.tracks || []);
      setFree(fr.tracks || []);
      setWhy((songs.tracks || []).length ? null : (songs.diag || (songs.error ? { error: songs.error } : null)));
      setArtists((arts.artists || []).slice(0, 6));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [q]);

  return (
    <div className="space-y-6">
      <SearchBar initial={q} />

      {!q && <p className="text-sm text-white/40">Type a song or artist and press Enter.</p>}

      {q && <h1 className="text-2xl md:text-3xl font-bold">Songs for “{q}”</h1>}

      {q && (loading ? (
        <div className="flex justify-center py-16 text-white/50"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          <TrackList
            tracks={tracks}
            savedIds={lib.savedIds}
            playlists={lib.playlists}
            onToggleSave={lib.toggleSave}
            onCreatePlaylist={lib.createPlaylist}
            onAddToPlaylist={lib.addToPlaylist}
            emptyText="No songs found. Try another search."
          />
          {free.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white/90">Free to download</h2>
              <p className="text-xs text-white/40">Creative Commons and public-domain music. You can save these for offline listening; keep the credit if you reuse them.</p>
              <TrackList
                tracks={free}
                savedIds={lib.savedIds}
                playlists={lib.playlists}
                onToggleSave={lib.toggleSave}
                onCreatePlaylist={lib.createPlaylist}
                onAddToPlaylist={lib.addToPlaylist}
                emptyText=""
              />
            </section>
          )}
          {DEBUG && !tracks.length && why && (
            <div className="text-xs text-white/40 space-y-0.5">
              {Object.entries(why).map(([k, v]) => <div key={k}>{k}: {String(v)}</div>)}
            </div>
          )}

          {artists.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 text-white/90">Artists</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {artists.map((a) => (
                  <Link to={`/music/artist/${a.channelId}`} key={a.channelId} className="glass glass-hover rounded-2xl p-3 flex flex-col items-center text-center">
                    <img src={a.thumbnail} alt="" className="w-16 h-16 rounded-full object-cover mb-2" />
                    <div className="text-sm font-medium truncate w-full">{a.title}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      ))}
    </div>
  );
}
