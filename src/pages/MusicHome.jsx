import React, { useEffect, useState } from 'react';
// base44 removed — using fetch to /api/searchMusic instead
import SearchBar from '@/components/SearchBar';
import TrackGrid from '@/components/TrackGrid';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/searchMusic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'trending', maxResults: 50 }) }).then(r => r.json());
        setTracks(res.data?.tracks || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center text-center pt-2 pb-4">
        <h1 className="font-display font-extrabold tracking-tight leading-none" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
          <span className="text-foreground">sarmax</span><span className="text-primary">stream</span>
        </h1>
        <div className="w-full max-w-2xl mt-6">
          <SearchBar />
        </div>
      </div>

      <section>
        {loading ? (
          <div className="flex justify-center py-12 text-white/40"><Loader2 className="animate-spin" /></div>
        ) : (
          <TrackGrid tracks={tracks} emptyText="Couldn't load tracks right now." />
        )}
      </section>
    </div>
  );
}
