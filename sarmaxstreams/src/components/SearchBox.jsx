import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { tmdbSearch, imageUrl } from "@/lib/tmdb";

// Remembers results for the current visit so typing the same thing twice
// (or backspacing) doesn't hit the API again.
const cache = new Map();

async function fetchSuggestions(term) {
  const key = term.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const data = await tmdbSearch(term);
  const items = (data?.results || [])
    .filter((r) => (r.media_type === "movie" || r.media_type === "tv") && r.poster_path)
    .slice(0, 6);
  cache.set(key, items);
  return items;
}

/**
 * Search field with a dropdown of suggestions that appears while you type.
 *  - size="nav"  -> compact field for the top bar
 *  - size="page" -> larger field for phones (Search page)
 */
export default function SearchBox({ size = "nav", initial = "" }) {
  const navigate = useNavigate();
  const boxRef = useRef(null);
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Keep the field in sync when the page's ?q= changes.
  useEffect(() => {
    setQ(initial);
  }, [initial]);

  // Wait until you stop typing for 300ms, then look up suggestions.
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchSuggestions(term);
        if (!cancelled) {
          setItems(res);
          setActive(-1);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, open]);

  // Close the list when you tap or click anywhere else.
  useEffect(() => {
    const onOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, []);

  const goSearch = () => {
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  const goTitle = (item) => {
    setOpen(false);
    navigate(`/title/${item.media_type}/${item.id}`);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (open && active >= 0 && items[active]) goTitle(items[active]);
    else goSearch();
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    }
  };

  const term = q.trim();
  const showList = open && term.length >= 2 && (items.length > 0 || loading);
  const inputSize = size === "page" ? "h-11 text-base" : "h-10 text-sm";

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={onSubmit} role="search">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (items.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search movies, shows…"
          aria-label="Search movies and shows"
          aria-autocomplete="list"
          aria-expanded={showList}
          className={`w-full ${inputSize} pl-10 pr-10 rounded-full bg-white/5 border border-border/60 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60`}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </form>

      {showList && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl overflow-hidden border border-border/60 bg-card shadow-2xl"
        >
          {items.map((item, i) => {
            const title = item.title || item.name;
            const year = (item.release_date || item.first_air_date || "").slice(0, 4);
            return (
              <li key={`${item.media_type}-${item.id}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => goTitle(item)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${
                    i === active ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <img
                    src={imageUrl(item.poster_path, "w92")}
                    alt=""
                    loading="lazy"
                    className="w-9 h-[54px] rounded object-cover bg-muted shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {item.media_type === "tv" ? "Series" : "Movie"}
                      {year ? ` · ${year}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {items.length > 0 && (
            <li role="presentation">
              <button
                type="button"
                onClick={goSearch}
                className="w-full px-3 py-2.5 text-left text-sm text-primary hover:bg-white/5 border-t border-border/60"
              >
                See all results for “{term}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}