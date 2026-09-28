import React, { useEffect, useState } from 'react';
// base44 removed — using fetch to /api/searchMusic instead
import SearchBar from '@/components/SearchBar';
import TrackGrid from '@/components/TrackGrid';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // GET so Vercel's CDN can cache the chart (POST responses can't be cached).
        const res = await fetch('/api/searchMusic?mode=chart').then(r => r.json());
        setTracks(res.tracks || []);
        if (res.error) setError(res.error);
      } catch {
        setError('network');
      }
      setLoading(false);
    })();
  }, []);

  const emptyText = /quota/i.test(error)
    ? "We're experiencing high traffic right now. Please try again in a few minutes."
    : "Couldn't load tracks right now.";

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
        <h2 className="text-lg font-semibold mb-4 text-white/90">Famous Songs</h2>
        {loading ? (
          <div className="flex justify-center py-12 text-white/40"><Loader2 className="animate-spin" /></div>
        ) : (
          <TrackGrid tracks={tracks} emptyText={emptyText} />
        )}
      </section>
    </div>
  );
}
