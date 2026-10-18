import React, { useEffect, useRef, useState } from "react";
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

// A row that only downloads its data when you scroll close to it.
// Fewer requests at the start = the top of the page shows up much sooner.
function LazyRow({ title, load }) {
  const ref = useRef(null);
  const [items, setItems] = useState(null);

  useEffect(() => {
    let active = true;
    const start = () => {
      load()
        .then((r) => active && setItems(r))
        .catch(() => active && setItems([]));
    };
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      start();
      return () => {
        active = false;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "700px" }
    );
    io.observe(el);
    return () => {
      active = false;
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref}>
      <MovieRow title={title} items={items || []} loading={items === null} />
    </div>
  );
}

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
  const [heroLoading, setHeroLoading] = useState(true);
  const [trending, setTrending] = useState(null);
  const [popMovies, setPopMovies] = useState(null);
  const [popTv, setPopTv] = useState(null);
  const [continueItems, setContinueItems] = useState([]);

  // Only the 3 things you see first are loaded right away, and each one shows
  // the moment it arrives (no waiting for the slowest request).
  useEffect(() => {
    let active = true;
    tmdbTrending("week")
      .then((trend) => {
        if (!active) return;
        const list = trend?.results || [];
        setHero(list.find((r) => r.backdrop_path) || list[0] || null);
        setTrending(list.filter((r) => r.media_type !== "person"));
      })
      .catch(() => active && setTrending([]))
      .finally(() => active && setHeroLoading(false));
    tmdbPopular("movie")
      .then((r) => active && setPopMovies(r?.results || []))
      .catch(() => active && setPopMovies([]));
    tmdbPopular("tv")
      .then((r) => active && setPopTv(r?.results || []))
      .catch(() => active && setPopTv([]));
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
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero item={hero} loading={heroLoading} />

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

        <MovieRow title="Trending Now" items={trending || []} loading={trending === null} priority />
        <MovieRow title="Popular Movies" items={popMovies || []} loading={popMovies === null} />
        <MovieRow title="Popular Series" items={popTv || []} loading={popTv === null} />
        <LazyRow title="Popular Anime" load={() => animeList("popular").then((r) => r.items)} />
        <LazyRow title="Top Rated" load={() => tmdbTopRated("movie").then((r) => r?.results || [])} />
        {GENRE_ROWS.map((g) => (
          <LazyRow
            key={g.label}
            title={g.label}
            load={() => tmdbByGenre(g.type, g.id).then((r) => (r?.results || []).filter((x) => x.poster_path))}
          />
        ))}
      </div>
    </div>
  );
}
