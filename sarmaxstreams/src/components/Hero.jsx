import React from "react";
import { Link } from "react-router-dom";
import { Play, Star } from "lucide-react";
import { backdropUrl } from "@/lib/tmdb";

export default function Hero({ item }) {
  if (!item) return null;
  const type = item.media_type || (item.first_air_date ? "tv" : "movie");
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  return (
    <section className="relative h-[78vh] min-h-[520px] w-full overflow-hidden">
      <div className="absolute inset-0">
        {backdropUrl(item.backdrop_path) && (
          <img
            src={backdropUrl(item.backdrop_path, "original")}
            alt={title}
            className="w-full h-full object-cover scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
      </div>

      <div className="relative h-full mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 flex flex-col justify-end pb-20">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-4 text-sm">
            <span className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground font-semibold uppercase tracking-wide text-xs">
              Featured
            </span>
            {item.vote_average > 0 && (
              <span className="flex items-center gap-1 text-foreground">
                <Star className="w-4 h-4 fill-primary text-primary" />
                {Math.round(item.vote_average * 10) / 10}
              </span>
            )}
            {year && <span className="text-muted-foreground">{year}</span>}
            <span className="text-muted-foreground uppercase text-xs">{type === "tv" ? "Series" : "Movie"}</span>
          </div>
          <h1 className="font-display font-bold tracking-tight text-balance leading-[1.05] mb-4"
              style={{ fontSize: "clamp(2.25rem, 6vw, 4.5rem)" }}>
            {title}
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed line-clamp-3 mb-6 max-w-xl">
            {item.overview}
          </p>
          <div className="flex items-center gap-3">
            <Link
              to={`/title/${type}/${item.id}`}
              className="flex items-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground font-semibold hover:brightness-110 transition"
            >
              <Play className="w-5 h-5 fill-primary-foreground" />
              Play
            </Link>
            <Link
              to={`/title/${type}/${item.id}`}
              className="flex items-center gap-2 h-12 px-6 rounded-full bg-white/10 border border-white/15 text-foreground font-500 hover:bg-white/15 transition"
            >
              Details
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
