import React, { useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import PosterGrid from "@/components/PosterGrid";
import { animeList, animeSearch } from "@/lib/anime";

const CATEGORIES = [
  { key: "airing", label: "Airing Now" },
  { key: "popular", label: "Popular" },
  { key: "top", label: "Top Rated" },
  { key: "movies", label: "Movies" },
];

function mergeUnique(prev, next) {
  const seen = new Set(prev.map((i) => i.id));
  return [...prev, ...next.filter((i) => !seen.has(i.id))];
}

export default function AnimePage() {
  const [category, setCategory] = useState("airing");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState(""); // debounced query
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const load = async (pageNum, replace) => {
    const my = ++reqId.current;
    setLoading(true);
    setError("");
    try {
      const res = dq ? await animeSearch(dq, pageNum) : await animeList(category, pageNum);
      if (my !== reqId.current) return;
      setItems((prev) => (replace ? res.items : mergeUnique(prev, res.items)));
      setHasNext(res.hasNext);
      setPage(pageNum);
    } catch (e) {
      if (my === reqId.current) setError(e.message || "Failed to load");
    } finally {
      if (my === reqId.current) setLoading(false);
    }
  };

  useEffect(() => {
    setItems([]);
    load(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, dq]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-nav pb-page mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
        <h1 className="font-display font-bold text-2xl sm:text-3xl mb-5">Anime</h1>

        <div className="relative max-w-xl mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search anime…"
            aria-label="Search anime"
            className="h-11 w-full rounded-full bg-white/5 border border-border/60 pl-11 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/60"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {dq ? (
          <p className="text-sm text-muted-foreground mb-5">Results for “{dq}”</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                aria-pressed={category === c.key}
                className={`shrink-0 h-10 px-5 rounded-full text-sm font-medium border transition ${
                  category === c.key
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-white/5 border-border/60 text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="py-10 text-center text-muted-foreground">
            <p className="mb-3">{error}</p>
            <button
              onClick={() => load(1, true)}
              className="h-10 px-5 rounded-full bg-white/10 border border-white/15 text-sm hover:bg-white/15 transition"
            >
              Try again
            </button>
          </div>
        )}

        {items.length === 0 && loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          !error && <PosterGrid items={items} emptyMessage="No anime found." />
        )}

        {hasNext && items.length > 0 && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => load(page + 1, false)}
              disabled={loading}
              className="flex items-center gap-2 h-11 px-7 rounded-full bg-white/10 border border-white/15 text-sm font-medium hover:bg-white/15 transition disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}