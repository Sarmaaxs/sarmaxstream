import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search, Bookmark, Music4, BookOpen } from "lucide-react";

const TABS = [
  { label: "Home", to: "/", icon: Home, match: (p) => p === "/" },
  { label: "Search", to: "/search", icon: Search, match: (p) => p.startsWith("/search") },
  { label: "Music", to: "/music", icon: Music4, match: (p) => p.startsWith("/music") },
  { label: "Books", to: "/books", icon: BookOpen, match: (p) => p.startsWith("/books") },
  { label: "My List", to: "/watchlist", icon: Bookmark, match: (p) => p.startsWith("/watchlist") },
];

const HIDDEN_ON = ["/login", "/register", "/forgot-password", "/reset-password"];

// Material 3 style navigation bar (Soundbound look): tonal surface, the active
// tab gets a rounded "pill" behind its icon and a bold label.
export default function MobileBottomNav() {
  const { pathname } = useLocation();
  if (HIDDEN_ON.includes(pathname)) return null;
  const inMusic = pathname.startsWith("/music");

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card pb-safe"
    >
      <ul className="flex items-stretch justify-around h-20">
        {TABS.map(({ label, to: baseTo, icon: Icon, match }) => {
          // Inside the music section, the Search tab searches music.
          const to = label === "Search" && inMusic ? "/music/search" : baseTo;
          const active = label === "Search" && inMusic ? pathname === "/music/search" : match(pathname);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className="h-full flex flex-col items-center justify-center gap-1 pt-1 active:opacity-80"
              >
                <span
                  className={`h-8 w-16 rounded-full flex items-center justify-center transition-colors duration-200 ${
                    active ? "bg-primary/25 text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                </span>
                <span
                  className={`text-[12px] leading-none ${
                    active ? "text-foreground font-semibold" : "text-muted-foreground font-medium"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
