import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MovieCard from "./MovieCard";

export default function MovieRow({ title, items, loading }) {
  const ref = useRef(null);

  const scroll = (dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  if (!loading && (!items || items.length === 0)) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-10 mb-3">
        <h2 className="font-display font-bold text-xl sm:text-2xl">{title}</h2>
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => scroll(-1)}
            className="w-9 h-9 rounded-full bg-white/5 border border-border/60 flex items-center justify-center hover:bg-white/10 transition"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll(1)}
            className="w-9 h-9 rounded-full bg-white/5 border border-border/60 flex items-center justify-center hover:bg-white/10 transition"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto no-scrollbar px-4 sm:px-6 lg:px-10 pb-2"
      >
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[150px] sm:w-[170px] aspect-[2/3] rounded-xl bg-muted animate-pulse" />
            ))
          : items.map((item, i) => <MovieCard key={item.id || i} item={item} index={i} />)}
      </div>
    </section>
  );
}
