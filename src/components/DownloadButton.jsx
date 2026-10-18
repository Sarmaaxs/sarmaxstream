import React from "react";
import { Download } from "lucide-react";

function getDownloadUrl({ tmdbId, mediaType, season, episode }) {
  if (!tmdbId) return null;

  // TV Shows require season and episode
  if (mediaType === "tv" || mediaType === "show") {
    const s = season || 1;
    const e = episode || 1;
    return `https://vidsrc.to/embed/tv/${tmdbId}/${s}/${e}`;
  }

  // Movies
  return `https://vidsrc.to/embed/movie/${tmdbId}`;
}

export default function DownloadButton({ tmdbId, mediaType, season, episode }) {
  const href = getDownloadUrl({ tmdbId, mediaType, season, episode });

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 h-12 px-6 rounded-full bg-white/10 border border-white/15 font-semibold hover:bg-white/15 transition"
    >
      <Download className="w-5 h-5" />
      Download
    </a>
  );
}