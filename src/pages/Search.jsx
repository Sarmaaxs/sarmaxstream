import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import Navbar from "@/components/Navbar";
import SearchBox from "@/components/SearchBox";
import PosterGrid from "@/components/PosterGrid";
import { tmdbSearch, tmdbPopular, tmdbByGenre, tmdbGenres } from "@/lib/tmdb";

export default function SearchPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const q = params.get("q") || "";
  const browseType = params.get("genre"); // "movie" | "tv"

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genres, setGenres] = useState([]);
  const [activeGenre, setActiveGenre] = useState(null);
  const [title, setTitle] = useState("Search");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        if (q) {
          setTitle(`Results for “${q}”`);
          const data = await tmdbSearch(q);
          if (!active) return;
          setResults((data?.results || []).filter((r) => r.media_type !== "person" && (r.poster_path || r.backdrop_path)));
          setGenres([]);
          setActiveGenre(null);
        } else if (browseType === "movie" || browseType === "tv") {
          setTitle(browseType === "movie" ? "Movies" : "TV Shows");
          const [pop, g] = await Promise.all([tmdbPopular(browseType, 1), tmdbGenres(browseType)]);
          if (!active) return;
          setResults((pop?.results || []).filter((r) => r.poster_path));
          setGenres(g?.genres || []);
          setActiveGenre(null);
        } else {
          setTitle("Search");
          setResults([]);
          setGenres([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [q, browseType]);

  useEffect(() => {
    if (!browseType || q) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = activeGenre
          ? await tmdbByGenre(browseType, activeGenre, 1)
          : await tmdbPopular(browseType, 1);
        if (!active) return;
        setResults((data?.results || []).filter((r) => r.poster_path));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeGenre, browseType, q]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-nav pb-page mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3 mb-2">
          <SearchIcon className="w-6 h-6 text-primary" />
          <h1 className="font-display font-bold text-2xl sm:text-3xl">{title}</h1>
        </div>

        {/* Phones: the navbar search field is hidden below `sm` and the hamburger menu
            is gone, so search + the Movies / TV Shows shortcuts live here. */}
        <div className="md:hidden mt-4 mb-2">
          <div className="sm:hidden mb-3">
            <SearchBox size="page" initial={q} />
          </div>
          <div className="flex gap-2">
            {[
              { label: "Movies", value: "movie" },
              { label: "TV Shows", value: "tv" },
            ].map((c) => (
              <Link
                key={c.value}
                to={`/search?genre=${c.value}`}
                className={`h-9 px-4 inline-flex items-center rounded-full text-sm border transition ${
                  browseType === c.value && !q
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white/5 border-border/60 hover:bg-white/10"
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>

        {genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6 mt-4">
            <button
              onClick={() => setActiveGenre(null)}
              className={`h-9 px-4 rounded-full text-sm border transition ${
                !activeGenre ? "bg-primary text-primary-foreground border-primary" : "bg-white/5 border-border/60 hover:bg-white/10"
              }`}
            >
              All
            </button>
            {genres.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGenre(g.id)}
                className={`h-9 px-4 rounded-full text-sm border transition ${
                  activeGenre === g.id ? "bg-primary text-primary-foreground border-primary" : "bg-white/5 border-border/60 hover:bg-white/10"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <PosterGrid
            items={results}
            emptyMessage={
              !q && !browseType
                ? "Search for a movie or show to get started."
                : "No titles found. Try another search."
            }
          />
        )}
      </div>
    </div>
  );
}