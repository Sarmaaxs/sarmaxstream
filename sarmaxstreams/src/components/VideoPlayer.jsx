import React, { useEffect, useRef, useState } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { recordContinueWatching } from "@/lib/library";

const SAFE_KEY = "sarmaxstream:movie-popup-block";
// Sandbox lets the player run but blocks it from opening tabs or redirecting the page.
const SANDBOX = "allow-scripts allow-same-origin allow-forms allow-presentation";
const IS_MOBILE = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function readSafe() {
  try {
    const v = localStorage.getItem(SAFE_KEY);
    if (v) return v === "on";
  } catch {
    /* ignore */
  }
  // No saved choice yet: on for desktop, off for mobile (some mobile embeds
  // refuse to play at all inside a sandboxed iframe).
  return !IS_MOBILE;
}

export default function VideoPlayer({ open, onClose, mediaType, tmdbId, title, poster, backdrop, season, episode }) {
  const [loading, setLoading] = useState(true);
  const [safe, setSafe] = useState(readSafe);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setLoading(true);
      recordedRef.current = false;
    }
  }, [open, tmdbId, season, episode]);

  useEffect(() => {
    if (!open) return;
    recordedRef.current = true;
    recordContinueWatching(
      { id: tmdbId, title, poster_path: poster, backdrop_path: backdrop, media_type: mediaType },
      { season, episode }
    ).catch(() => {});
  }, [open, tmdbId, mediaType, title, poster, backdrop, season, episode]);

  if (!open) return null;

  const toggleSafe = () => {
    const next = !safe;
    setSafe(next);
    setLoading(true);
    try {
      localStorage.setItem(SAFE_KEY, next ? "on" : "off");
    } catch {
      /* ignore */
    }
  };

  const s = season || 1;
  const e = episode || 1;
  const id = encodeURIComponent(tmdbId);
  const src =
    mediaType === "tv"
      ? `https://vidlink.pro/tv/${id}/${s}/${e}`
      : `https://vidlink.pro/movie/${id}`;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col pt-safe pb-safe">
      <div className="h-14 flex items-center justify-between px-4 sm:px-6 glass border-b border-border/60">
        <div className="text-sm text-muted-foreground truncate">
          {title}
          {mediaType === "tv" && (
            <span className="ml-2 text-foreground">S{s}:E{e}</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 h-10 px-4 rounded-full bg-white/10 border border-white/15 text-sm hover:bg-white/15 transition"
        >
          <X className="w-4 h-4" />
          Close
        </button>
      </div>
      <div className="relative flex-1 w-full bg-black">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm">Loading stream…</span>
          </div>
        )}
        <iframe
          key={`${src}|${safe}`}
          src={src}
          title={title}
          allowFullScreen
          referrerPolicy="origin"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          sandbox={safe ? SANDBOX : undefined}
          className="w-full h-full"
          style={{ border: 0 }}
          onLoad={() => setLoading(false)}
        />
      </div>
      <div className="px-4 sm:px-6 py-2 flex flex-wrap items-center gap-2 border-t border-border/40">
        <button
          type="button"
          onClick={toggleSafe}
          aria-pressed={safe}
          title="Stops the video from opening new tabs or redirecting this page"
          className={`h-8 px-4 rounded-full text-xs font-semibold border transition ${
            safe
              ? "bg-white/10 border-primary/60 text-foreground"
              : "bg-white/5 border-border/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          Block pop-ups: {safe ? "On" : "Off"}
        </button>
        <span className="text-[11px] text-muted-foreground/70 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" />
          Stream provided by a third-party embed. sarmaxstream does not host any video files.
        </span>
      </div>
    </div>
  );
}