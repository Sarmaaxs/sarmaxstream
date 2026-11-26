import React, { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import MovieRow from "@/components/MovieRow";
import {
  tmdbTrending,
  tmdbPopular,
  tmdbTopRated,
  tmdbByGenre,
  backdropUrl,
} from "@/lib/tmdb";
import { animeList } from "@/lib/anime";
import { getContinueWatching } from "@/lib/library";
import { Link } from "react-router-dom";
import { Play } from "lucide-react";

const GENRE_ROWS = [
  { type: "movie", id: 28, label: "Action & Adventure" },
  { type: "movie", id: 35, label: "Comedy" },
  { type: "movie", id: 27, label: "Horror" },
  { type: "movie", id: 16, label: "Animation" },
  { type: "tv", id: 10759, label: "Action & Adventure — TV" },
  { type: "tv", id: 35, label: "Comedy — TV" },
];

export default function Home() {
  const [hero, setHero] = useState(null);
  const [trending, setTrending] = useState([]);
  const [popMovies, setPopMovies] = useState([]);
  const [popTv, setPopTv] = useState([]);
  const [popAnime, setPopAnime] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [genreRows, setGenreRows] = useState([]);
  const [continueItems, setContinueItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [trend, pm, pt, tr, ...genreResults] = await Promise.all([
          tmdbTrending("week"),
          tmdbPopular("movie"),
          tmdbPopular("tv"),
          tmdbTopRated("movie"),
          ...GENRE_ROWS.map((g) => tmdbByGenre(g.type, g.id)),
        ]);
        if (!active) return;
        const featured = (trend?.results || []).find((r) => r.backdrop_path) || (trend?.results || [])[0];
        setHero(featured || null);
        setTrending((trend?.results || []).filter((r) => r.media_type !== "person"));
        setPopMovies(pm?.results || []);
        setPopTv(pt?.results || []);
        setTopRated(tr?.results || []);
        setGenreRows(
          GENRE_ROWS.map((g, i) => ({
            ...g,
            items: (genreResults[i]?.results || []).filter((r) => r.poster_path),
          }))
        );
        getContinueWatching()
          .then((rows) => {
            if (!active) return;
            setContinueItems(
              rows.map((r) => ({
                id: r.tmdb_id,
                media_type: r.media_type,
                name: r.title,
                poster_path: r.poster_path,
                backdrop_path: r.backdrop_path,
                season: r.season,
                episode: r.episode,
              }))
            );
          })
          .catch(() => {});
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Anime row loads on its own so a Jikan hiccup never breaks the home page.
  useEffect(() => {
    let active = true;
    animeList("popular")
      .then((r) => active && setPopAnime(r.items))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero item={hero} />

      <div className="relative -mt-12 z-10 pb-page">
        {continueItems.length > 0 && (
          <section className="mb-10 px-4 sm:px-6 lg:px-10">
            <h2 className="font-display font-bold text-xl sm:text-2xl mb-3">Continue Watching</h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {continueItems.map((c) => (
                <Link
                  key={`${c.media_type}-${c.id}`}
                  to={`/title/${c.media_type}/${c.id}`}
                  className="group shrink-0 w-[260px] sm:w-[300px] rounded-xl overflow-hidden bg-card relative aspect-video"
                >
                  <img
                    src={backdropUrl(c.backdrop_path, "w780") || undefined}
                    alt={c.name}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                  <div className="absolute bottom-0 p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Play className="w-4 h-4 fill-primary-foreground" />
                      </span>
                      <div>
                        <div className="text-sm font-medium line-clamp-1">{c.name}</div>
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
              ))}
            </div>
          </section>
        )}

        <MovieRow title="Trending Now" items={trending} loading={loading} />
        <MovieRow title="Popular Movies" items={popMovies} loading={loading} />
        <MovieRow title="Popular Series" items={popTv} loading={loading} />
        <MovieRow title="Popular Anime" items={popAnime} loading={false} />
        <MovieRow title="Top Rated" items={topRated} loading={loading} />
        {genreRows.map((g) => (
          <MovieRow key={g.label} title={g.label} items={g.items} loading={loading} />
        ))}
      </div>
    </div>
  );
}