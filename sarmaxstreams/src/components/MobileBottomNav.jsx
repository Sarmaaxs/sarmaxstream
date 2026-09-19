import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search, Bookmark } from "lucide-react";

const TABS = [
  { label: "Home", to: "/", icon: Home, match: (p) => p === "/" },
  { label: "Search", to: "/search", icon: Search, match: (p) => p.startsWith("/search") },
  { label: "My List", to: "/watchlist", icon: Bookmark, match: (p) => p.startsWith("/watchlist") },
];

// Routes that are full-screen flows and shouldn't show the tab bar.
const HIDDEN_ON = ["/login", "/register", "/forgot-password", "/reset-password"];

/**
 * Bottom tab bar for phones / native WebView shells. Only rendered below the
 * `md` breakpoint (768px) via `md:hidden`, so there's no JS resize handling and
 * no flash on first paint. Pair with the `.pb-page` utility on page content so
 * the last row of content can scroll clear of it.
 */
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
