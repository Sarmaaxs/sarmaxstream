import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bookmark, Check } from "lucide-react";
import { currentUser, findWatchlistItem, toggleWatchlist } from "@/lib/library";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";

export default function WatchlistButton({ item, className = "" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  // A request is in flight: further taps are ignored until it settles so the
  // server-side toggle can't be raced by a double-tap.
  const inFlight = useRef(false);
  // Set once the user has tapped, so a slow initial lookup can't overwrite
  // the optimistic state with a stale answer.
  const interacted = useRef(false);

  useEffect(() => {
    let active = true;
    interacted.current = false;
    const mediaType = item.media_type || (item.first_air_date ? "tv" : "movie");
    findWatchlistItem(item.id || item.tmdb_id, mediaType)
      .then((row) => {
        if (!active || interacted.current) return;
        setSaved(!!row);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [item.id, item.tmdb_id, item.media_type]);

  const promptSignIn = () => {
    toast({
      title: "Sign in to save titles",
      description: "Create an account or sign in to keep a personal watchlist.",
      action: (
        <ToastAction
          altText="Sign in"
          onClick={() =>
            navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`)
          }
        >
          Sign in
        </ToastAction>
      ),
    });
  };

  const onClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (inFlight.current) return;
    inFlight.current = true;
    interacted.current = true;
    setError("");

    try {
      // Resolves from cache for signed-in users, so it doesn't delay the
      // optimistic flip; it just avoids flicker-then-rollback for guests.
      if (!(await currentUser())) {
        promptSignIn();
        return;
      }

      const previous = saved;
      setSaved(!previous); // optimistic: reflect the tap immediately
      try {
        const res = await toggleWatchlist(item);
        setSaved(res.saved); // reconcile with what the server actually did
      } catch (err) {
        setSaved(previous); // roll back
        const message = err?.message || "Couldn't update your list";
        setError(message);
        toast({ variant: "destructive", title: "Couldn't update your list", description: message });
      }
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <button
      onClick={onClick}
      aria-pressed={saved}
      className={`flex items-center gap-2 h-12 px-5 rounded-full font-medium transition active:scale-95 ${
        saved
          ? "bg-white/10 border border-white/15 text-foreground hover:bg-white/15"
          : "bg-secondary border border-border/60 text-foreground hover:bg-secondary/80"
      } ${className}`}
    >
      {saved ? <Check className="w-5 h-5 text-primary" /> : <Bookmark className="w-5 h-5" />}
      {saved ? "Saved" : "Save"}
      {error && <span className="sr-only">{error}</span>}
    </button>
  );
}
