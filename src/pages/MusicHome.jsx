import { cachedJson } from '@/lib/cache';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from '@/components/SearchBar';
import TrackGrid from '@/components/TrackGrid';
import { Loader2 } from 'lucide-react';
import { userKey } from '@/lib/telemetry';

// Quick-start chips (each one opens a music search).
const CHIPS = ['Trending', 'Amharic', 'Afrobeats', 'Hip Hop', 'Chill', 'Workout', 'Gospel', 'Pop'];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const [tracks, setTracks] = useState([]);
  const [forYou, setForYou] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // GET so Vercel's CDN can cache the chart (POST responses can't be cached).
        const res = await cachedJson('/api/searchMusic?mode=chart', undefined, 60 * 60 * 1000);
        setTracks(res.tracks || []);
        if (res.error) setError(res.error);
      } catch {
        setError('network');
      }
      setLoading(false);
    })();
  }, []);

  // "For You" from this device's own listening history (empty for new listeners).
  useEffect(() => {
    const user = userKey();
    if (!user) return undefined;
    let alive = true;
    fetch(`/api/recommend?user=${encodeURIComponent(user)}&limit=20`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && Array.isArray(d.tracks)) setForYou(d.tracks); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const emptyText = /quota/i.test(error)
    ? "We're experiencing high traffic right now. Please try again in a few minutes."
    : "Couldn't load tracks right now.";

  return (
    <div className="space-y-7">
      <div className="pt-1">
        <h1 className="font-display font-bold tracking-tight text-3xl sm:text-4xl text-foreground">{greeting()}</h1>
        <div className="w-full max-w-2xl mt-4">
          <SearchBar />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          {CHIPS.map((c) => (
            <Link
              key={c}
              to={`/music/search?q=${encodeURIComponent(c === 'Trending' ? 'trending songs' : c)}`}
              className="shrink-0 h-8 px-4 rounded-lg border border-border text-sm font-medium text-foreground/90 flex items-center hover:bg-secondary active:bg-secondary transition-colors"
            >
              {c}
            </Link>
          ))}
        </div>
      </div>

      {forYou.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3 text-foreground">For you</h2>
          <TrackGrid tracks={forYou} layout="row" />
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-3 text-foreground">Famous songs</h2>
        {loading ? (
          <div className="flex justify-center py-12 text-white/40"><Loader2 className="animate-spin" /></div>
        ) : (
          <TrackGrid tracks={tracks} emptyText={emptyText} />
        )}
      </section>
    </div>
  );
}
