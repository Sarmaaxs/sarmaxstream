import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Trash2, Bookmark } from "lucide-react";
import Navbar from "@/components/Navbar";
import PosterGrid from "@/components/PosterGrid";
import AccountDashboard from "@/components/AccountDashboard";
import { getWatchlist, getContinueWatching, removeContinueWatching } from "@/lib/library";
import { backdropUrl } from "@/lib/tmdb";

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState([]);
  const [continueItems, setContinueItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [w, c] = await Promise.all([getWatchlist(), getContinueWatching()]);
      setWatchlist(
        (w || []).map((r) => ({
          id: r.tmdb_id,
          media_type: r.media_type,
          title: r.title,
          name: r.title,
          poster_path: r.poster_path,
          release_date: r.release_year,
          vote_average: r.rating,
        }))
      );
      setContinueItems(c || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const removeFromContinue = async (id) => {
    try {
      await removeContinueWatching(id);
      setContinueItems((items) => items.filter((i) => i.id !== id));
    } catch {}
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-nav pb-page mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
        <h1 className="font-display font-bold text-2xl sm:text-3xl mb-6 flex items-center gap-3">
          <Bookmark className="w-7 h-7 text-primary" />
          My Library
        </h1>

        {continueItems.length > 0 && (
          <section className="mb-10">
            <h2 className="font-display font-bold text-xl mb-4">Continue Watching</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {continueItems.map((c) => (
                <div key={c.id} className="group relative rounded-xl overflow-hidden bg-card border border-border/60 aspect-video">
                  <Link to={`/title/${c.media_type}/${c.tmdb_id}`} className="block w-full h-full">
                    <img
                      src={backdropUrl(c.backdrop_path, "w780") || undefined}
                      alt={c.title}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                    <div className="absolute bottom-0 p-4">
                      <div className="flex items-center gap-2">
                        <span className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Play className="w-5 h-5 fill-primary-foreground" />
                        </span>
                        <div>
                          <div className="font-medium line-clamp-1">{c.title}</div>
                          {c.media_type === "tv" && c.season && (
                            <div className="text-xs text-muted-foreground">S{c.season}:E{c.episode}</div>
                          )}
                          {c.media_type === "anime" && c.episode && (
                            <div className="text-xs text-muted-foreground">Ep {c.episode}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={() => removeFromContinue(c.id)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 border border-white/15 flex items-center justify-center hover:bg-black/80 transition opacity-0 group-hover:opacity-100"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display font-bold text-xl mb-4">My Watchlist</h2>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <PosterGrid items={watchlist} emptyMessage="Your watchlist is empty. Browse and tap Save on a title." />
          )}
        </section>

        <AccountDashboard />
      </div>
    </div>
  );
}