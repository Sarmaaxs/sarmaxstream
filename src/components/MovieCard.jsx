import React from "react";
import { Link } from "react-router-dom";
import { Star, Play } from "lucide-react";
import { imageUrl } from "@/lib/tmdb";
import { animeCardType } from "@/lib/anime";

export default function MovieCard({ item, index = 0 }) {
  const type = animeCardType(item) || item.media_type || (item.first_air_date ? "tv" : "movie");
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const poster = imageUrl(item.poster_path, "w342");

  return (
    <Link
      to={`/title/${type}/${item.id}`}
      className="group relative shrink-0 w-[150px] sm:w-[170px] block rounded-xl overflow-hidden bg-card transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-primary/60"
      style={{ perspective: "1000px" }}
    >
      <div className="aspect-[2/3] bg-muted overflow-hidden">
        {poster ? (
          <img
            src={poster}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs px-2 text-center">
            {title}
          </div>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
        <div className="flex items-center gap-2 text-primary">
          <span className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Play className="w-4 h-4 fill-primary-foreground" />
          </span>
        </div>
      </div>
      <div className="p-2.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          {item.vote_average > 0 && (
            <span className="flex items-center gap-0.5 text-foreground">
              <Star className="w-3 h-3 fill-primary text-primary" />
              {Math.round(item.vote_average * 10) / 10}
            </span>
          )}
          {year && <span>• {year}</span>}
        </div>
        <h3 className="text-sm font-medium leading-tight line-clamp-2">{title}</h3>
      </div>
    </Link>
  );
}