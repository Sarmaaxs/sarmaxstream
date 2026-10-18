import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Film, Tv, Music4, BookOpen } from "lucide-react";
import { tmdbTrending, imageUrl } from "@/lib/tmdb";

// Split-screen auth layout: a calm poster wall on the left (desktop only), a clean
// form on the right. Nothing loops or floats — one short fade-in, and that's it.

const FEATURES = [
  { icon: Film, label: "Movies & TV" },
  { icon: Tv, label: "Anime" },
  { icon: Music4, label: "Music" },
  { icon: BookOpen, label: "Books" },
];

function PosterWall() {
  const [posters, setPosters] = useState([]);

  useEffect(() => {
    let alive = true;
    tmdbTrending("week")
      .then((d) => {
        if (!alive) return;
        const list = (d?.results || []).map((r) => r.poster_path).filter(Boolean).slice(0, 18);
        setPosters(list);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!posters.length) return null;
  const cols = [posters.slice(0, 6), posters.slice(6, 12), posters.slice(12, 18)];

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute -inset-[15%] flex gap-4 justify-center auth-fade"
        style={{ transform: "rotate(-8deg)" }}
      >
        {cols.map((col, ci) => (
          <div
            key={ci}
            className="flex flex-col gap-4 w-[22%] shrink-0"
            style={{ marginTop: ci === 1 ? "-6rem" : ci === 2 ? "2rem" : "0" }}
          >
            {col.map((p) => (
              <img
                key={p}
                src={imageUrl(p, "w342")}
                alt=""
                decoding="async"
                className="w-full aspect-[2/3] object-cover rounded-xl border border-white/10 shadow-2xl"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-background text-foreground">
      {/* Left: brand + poster wall */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-zinc-950 p-10 xl:p-14">
        <PosterWall />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-zinc-950/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/60 to-transparent" />

        <Link to="/" className="relative z-10 font-display font-bold text-xl tracking-tight w-fit">
          sarmax<span className="text-primary">stream</span>
        </Link>

        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.05]">
            Everything you love to watch, hear and read.
          </h2>
          <p className="mt-4 text-white/60 text-base leading-relaxed">
            One account for movies, TV, anime, music and books. Pick up exactly where you left off, on any device.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80"
              >
                <Icon className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Right: form */}
      <main className="flex flex-col px-5 sm:px-8 pt-safe pb-safe">
        <div className="lg:hidden pt-6">
          <Link to="/" className="font-display font-bold text-lg tracking-tight">
            sarmax<span className="text-primary">stream</span>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-[400px] auth-fade">
            <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-2 text-[15px]">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <p className="text-center text-sm text-muted-foreground mt-8">{footer}</p>}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/70 pb-6">
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <span className="mx-2">·</span>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        </p>
      </main>
    </div>
  );
}
