import React, { useEffect, useState } from "react";
import { X, Loader2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { recordContinueWatching } from "@/lib/library";
import { animeStreamUrl, AUDIO_OPTIONS, ANIME_SOURCES } from "@/lib/anime";

const SERVER_KEY = "sarmaxstream:anime-server";
const SAFE_KEY = "sarmaxstream:anime-popup-block";

// Pop-up blocker for the embedded video: the sandbox lets the player run,
// but blocks it from opening new tabs or redirecting your whole page.
// This lets popups open (so the player's own script doesn't refuse to run —
// most of it hits the browser's native popup blocker or an ad blocker anyway),
// but leaves out allow-top-navigation, so the player can NEVER redirect your
// whole page away. That's the one thing this sandbox guarantees.
const SANDBOX = "allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox";

const IS_MOBILE = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function readSafe() {
  try {
    const v = localStorage.getItem(SAFE_KEY);
    if (v) return v === "on";
  } catch {
    /* ignore */
  }
  // No saved choice yet: on for desktop, off for mobile (many mobile embeds
  // refuse to play at all inside a sandboxed iframe and show "sandbox detected").
  return !IS_MOBILE;
}

function readServer() {
  try {
    const s = localStorage.getItem(SERVER_KEY);
    return ANIME_SOURCES.some((x) => x.id === s) ? s : ANIME_SOURCES[0].id;
  } catch {
    return ANIME_SOURCES[0].id;
  }
}

// Small Sub / Dub switch, used here and on the anime detail page.
export function AudioToggle({ value, onChange, className = "" }) {
  return (
    <div
      role="group"
      aria-label="Audio language"
      className={`inline-flex items-center rounded-full bg-white/5 border border-border/60 p-1 ${className}`}
    >
      {AUDIO_OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={`h-8 px-4 rounded-full text-xs font-semibold uppercase tracking-wide transition ${
            value === opt
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function AnimePlayer({
  open,
  onClose,
  malId,
  title,
  poster,
  backdrop,
  episode,
  totalEpisodes,
  audio,
  onAudioChange,
  onEpisodeChange,
}) {
  const [loading, setLoading] = useState(true);
  const [server, setServer] = useState(readServer);
  const [safe, setSafe] = useState(readSafe);

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
  const src = animeStreamUrl(malId, episode, audio, server);

  const changeServer = (id) => {
    setServer(id);
    try {
      localStorage.setItem(SERVER_KEY, id);
    } catch {
      /* ignore */
    }
  };

  // Show the spinner again whenever the episode / audio changes.
  useEffect(() => {
    if (open) setLoading(true);
  }, [open, src]);

  // Save progress for "Continue Watching".
  useEffect(() => {
    if (!open) return;
    recordContinueWatching(
      { id: malId, title, poster_path: poster, backdrop_path: backdrop, media_type: "anime" },
      { season: 1, episode }
    ).catch(() => {});
  }, [open, malId, title, poster, backdrop, episode]);

  // Esc closes the player.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasPrev = episode > 1;
  const hasNext = !totalEpisodes || episode < totalEpisodes;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col pt-safe pb-safe">
      <div className="h-14 flex items-center justify-between gap-3 px-4 sm:px-6 glass border-b border-border/60">
        <div className="text-sm text-muted-foreground truncate min-w-0">
          {title}
          <span className="ml-2 text-foreground">Ep {episode}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AudioToggle value={audio} onChange={onAudioChange} />
          <button
            onClick={onClose}
            className="flex items-center gap-2 h-10 px-4 rounded-full bg-white/10 border border-white/15 text-sm hover:bg-white/15 transition"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
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
          sandbox={safe ? SANDBOX : undefined}
          title={`${title} episode ${episode}`}
          allowFullScreen
          referrerPolicy="origin"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          className="w-full h-full"
          style={{ border: 0 }}
          onLoad={() => setLoading(false)}
        />
      </div>

      <div className="px-4 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar border-t border-border/40">
        <span className="shrink-0 text-xs text-muted-foreground mr-1">Server</span>
        {ANIME_SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => changeServer(s.id)}
            aria-pressed={server === s.id}
            className={`shrink-0 h-8 px-4 rounded-full text-xs font-semibold border transition ${
              server === s.id
                ? "bg-primary text-primary-foreground border-transparent"
                : "bg-white/5 border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          onClick={toggleSafe}
          aria-pressed={safe}
          title="Stops the page itself from being redirected. New-tab pop-ups may still slip through; a browser ad blocker like uBlock Origin catches most of those."
          className={`shrink-0 ml-2 h-8 px-4 rounded-full text-xs font-semibold border transition ${
            safe
              ? "bg-white/10 border-primary/60 text-foreground"
              : "bg-white/5 border-border/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          Block redirects: {safe ? "On" : "Off"}
        </button>
        <span className="shrink-0 ml-1 text-[11px] text-muted-foreground/70">
          Not playing? Try another server, Sub/Dub, or turn redirect blocking off.
        </span>
      </div>

      <div className="px-4 sm:px-6 py-2 flex items-center justify-between gap-3 border-t border-border/40">
        <button
          onClick={() => hasPrev && onEpisodeChange(episode - 1)}
          disabled={!hasPrev}
          className="flex items-center gap-1 h-10 px-4 rounded-full bg-white/10 border border-white/15 text-sm hover:bg-white/15 transition disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>
        <span className="text-sm text-muted-foreground">
          Episode {episode}
          {totalEpisodes ? ` / ${totalEpisodes}` : ""}
        </span>
        <button
          onClick={() => hasNext && onEpisodeChange(episode + 1)}
          disabled={!hasNext}
          className="flex items-center gap-1 h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition disabled:opacity-40 disabled:pointer-events-none"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 sm:px-6 py-2 text-[11px] text-muted-foreground/70 flex items-center gap-2 border-t border-border/40">
        <AlertTriangle className="w-3 h-3" />
        Stream provided by a third-party embed. sarmaxstream does not host any video files.
      </div>
    </div>
  );
}