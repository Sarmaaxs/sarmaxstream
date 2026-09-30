import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import SearchBar from '@/components/SearchBar';
import TrackList from '@/components/TrackList';
import { useMusicLibrary } from '@/lib/useMusicLibrary';
import { Loader2 } from 'lucide-react';

const RECENT_KEY = 'sarmax_recent_searches';

function saveRecentSearch(q) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const next = [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

async function post(body) {
  const r = await fetch('/api/searchMusic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DEBUG ? { ...body, debug: true } : body) });
  return r.json();
}

export default function SearchResults() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const lib = useMusicLibrary();
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState([]);
  const [why, setWhy] = useState(null);

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')); } catch {}
  }, [q]);

  useEffect(() => {
    if (!q) { setTracks([]); setArtists([]); setLoading(false); return undefined; }
    let active = true;
    setLoading(true);
    saveRecentSearch(q);
    (async () => {
      // Songs are the main result; artists are a small extra row, and only real ones.
      const [songs, arts] = await Promise.all([
        post({ query: q, mode: 'search', maxResults: 25 }).catch(() => ({})),
        post({ query: q, mode: 'artists', maxResults: 10 }).catch(() => ({})),
      ]);
      if (!active) return;
      setTracks(songs.tracks || []);
      setWhy((songs.tracks || []).length ? null : (songs.diag || (songs.error ? { error: songs.error } : null)));
      setArtists((arts.artists || []).slice(0, 6));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [q]);

  return (
    <div className="space-y-6">
      <SearchBar initial={q} />

      {!q && recent.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white/70 mb-2">Recent searches</h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <Link key={r} to={`/music/search?q=${encodeURIComponent(r)}`} className="glass rounded-full px-3 py-1.5 text-sm text-white/80">{r}</Link>
            ))}
          </div>
        </div>
      )}

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
