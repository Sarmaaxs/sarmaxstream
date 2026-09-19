import React, { useEffect, useRef, useState } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { recordContinueWatching } from "@/lib/library";

export default function VideoPlayer({ open, onClose, mediaType, tmdbId, title, poster, backdrop, season, episode }) {
  const [loading, setLoading] = useState(true);
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
          key={src}
          src={src}
          title={title}
          allowFullScreen
          referrerPolicy="origin"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          className="w-full h-full"
          style={{ border: 0 }}
          onLoad={() => setLoading(false)}
        />
      </div>
      <div className="px-4 sm:px-6 py-2 text-[11px] text-muted-foreground/70 flex items-center gap-2 border-t border-border/40">
        <AlertTriangle className="w-3 h-3" />
        Stream provided by a third-party embed. sarmaxstream does not host any video files.
      </div>
    </div>
  );
}
