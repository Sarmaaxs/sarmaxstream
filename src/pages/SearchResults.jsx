import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
// base44 removed — using fetch to /api/searchMusic instead
import SearchBar from '@/components/SearchBar';
import { Loader2 } from 'lucide-react';

export default function SearchResults() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q) { setArtists([]); setLoading(false); return; }
    setLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/searchMusic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, mode: 'artists', maxResults: 20 }) }).then(r => r.json());
        setArtists(res.artists || []);
      } catch {}
      setLoading(false);
    })();
  }, [q]);

  return (
    <div className="space-y-6">
      <SearchBar initial={q} />
      <h1 className="text-2xl md:text-3xl font-bold">Artists for “{q}”</h1>
      {loading ? (
        <div className="flex justify-center py-16 text-white/50"><Loader2 className="animate-spin" /></div>
      ) : artists.length === 0 ? (
        <div className="text-white/40 text-sm glass rounded-2xl py-10 text-center">No artists found. Try another search.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {artists.map((a) => (
            <Link to={`/artist/${a.channelId}`} key={a.channelId} className="glass glass-hover rounded-2xl p-4 flex flex-col items-center text-center">
              <img src={a.thumbnail} alt="" className="w-24 h-24 rounded-full object-cover mb-3" />
              <div className="font-medium truncate w-full">{a.title}</div>
              <div className="text-xs text-white/40 mt-1">Artist</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
