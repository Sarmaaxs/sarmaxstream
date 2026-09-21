import React from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { imageUrl } from "@/lib/tmdb";
import { animeCardType } from "@/lib/anime";

export default function PosterGrid({ items, emptyMessage = "Nothing here yet." }) {
  if (!items || items.length === 0) {
    return <div className="text-muted-foreground py-20 text-center">{emptyMessage}</div>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map((item, i) => {
        const type = animeCardType(item) || item.media_type || (item.first_air_date ? "tv" : "movie");
        const id = item.id || item.tmdb_id;
        const title = item.title || item.name;
        const year = (item.release_date || item.release_year || item.first_air_date || "").toString().slice(0, 4);
        const poster = imageUrl(item.poster_path, "w342");
        return (
          <Link
            key={id || i}
            to={`/title/${type}/${id}`}
            className="group rounded-xl overflow-hidden bg-card hover:ring-2 hover:ring-primary/60 transition"
          >
            <div className="aspect-[2/3] bg-muted overflow-hidden">
              {poster ? (
                <img
                  src={poster}
                  alt={title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs px-2 text-center">
                  {title}
                </div>
              )}
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
      })}
    </div>
  );
}