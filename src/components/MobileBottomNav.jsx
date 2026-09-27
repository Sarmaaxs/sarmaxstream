import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search, Bookmark, Music4 } from "lucide-react";

const TABS = [
  { label: "Home", to: "/", icon: Home, match: (p) => p === "/" },
  { label: "Search", to: "/search", icon: Search, match: (p) => p.startsWith("/search") },
  { label: "Music", to: "/music", icon: Music4, match: (p) => p.startsWith("/music") },
  { label: "My List", to: "/watchlist", icon: Bookmark, match: (p) => p.startsWith("/watchlist") },
];

const HIDDEN_ON = ["/login", "/register", "/forgot-password", "/reset-password"];

export default function MobileBottomNav() {
  const { pathname } = useLocation();
  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/90 backdrop-blur-xl pb-safe"
    >
      <ul className="flex items-stretch justify-around h-14">
        {TABS.map(({ label, to, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground active:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
