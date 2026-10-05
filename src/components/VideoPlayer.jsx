import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, SkipBack, SkipForward, Star, ShieldCheck, Play } from "lucide-react";
import { useAutoServer } from "@/lib/useAutoServer";
import { recordContinueWatching } from "@/lib/library";
import { imageUrl } from "@/lib/tmdb";

// ---------------------------------------------------------------------------
// Watch page (MovieBox-style): the player on top, and underneath it the info,
// episodes (series) and "More like this".
// The picture comes from a third-party embed. If a server is down or never loads,
// the next one is tried automatically in the background (no server buttons).
// ---------------------------------------------------------------------------

const SERVER_KEY = "sarmaxstream:movie-server";
const SAFE_KEY = "sarmaxstream:movie-popup-block";
const SANDBOX = "allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox";
const IS_MOBILE = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const VL = "primaryColor=e5484d&secondaryColor=a2a2a2&iconColor=ffffff&title=true&poster=true&autoplay=true";
const SERVERS = [
  {
    id: "vl1", label: "Server 1",
    url: (tv, id, s, e) => (tv ? `https://vidlink.pro/tv/${id}/${s}/${e}?${VL}&icons=vid&player=default&nextbutton=true` : `https://vidlink.pro/movie/${id}?${VL}&icons=vid&player=default`),
  },
  {
    id: "vl2", label: "Server 2",
    url: (tv, id, s, e) => (tv ? `https://vidlink.pro/tv/${id}/${s}/${e}?${VL}&player=jw&nextbutton=true` : `https://vidlink.pro/movie/${id}?${VL}&player=jw`),
  },
  {
    id: "vs1", label: "Server 3",
    url: (tv, id, s, e) => (tv ? `https://vidsrc.to/embed/tv/${id}/${s}/${e}` : `https://vidsrc.to/embed/movie/${id}`),
  },
  {
    id: "vs2", label: "Server 4",
    url: (tv, id, s, e) => (tv ? `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}` : `https://vidsrc.xyz/embed/movie?tmdb=${id}`),
  },
];

function readSafe() {
  try {
    const v = localStorage.getItem(SAFE_KEY);
    if (v) return v === "on";
  } catch { /* ignore */ }
  return !IS_MOBILE; // some mobile embeds refuse to play inside a sandbox
}
const SERVER_IDS = SERVERS.map((x) => x.id);

export default function VideoPlayer({
  open, onClose, mediaType, tmdbId, title, poster, backdrop, season, episode,
  overview = "", year = "", rating = 0,
  similar = [], episodes = [], seasons = [], pageSeason, onSeasonChange, onEpisodeChange,
}) {
  const navigate = useNavigate();
  const [safe, setSafe] = useState(readSafe);

  const tv = mediaType === "tv";
  const s = season || 1;
  const e = episode || 1;
  const id = encodeURIComponent(tmdbId);
  const { index, onLoad, failedAll, retry } = useAutoServer({
    ids: SERVER_IDS,
    storageKey: SERVER_KEY,
    resetKey: `${tmdbId}|${mediaType}|${s}|${e}|${open}|${safe}`,
    getSrc: (i) => SERVERS[i].url(tv, id, s, e),
  });
  const src = SERVERS[index].url(tv, id, s, e);
  const [loading, setLoading] = useState(true);
  // spinner again when the movie / episode / server changes
  useEffect(() => { setLoading(true); }, [open, src, safe]);

  // remember for "Continue Watching"
  useEffect(() => {
    if (!open) return;
    recordContinueWatching(
      { id: tmdbId, title, poster_path: poster, backdrop_path: backdrop, media_type: mediaType },
      { season, episode }
    ).catch(() => {});
  }, [open, tmdbId, mediaType, title, poster, backdrop, season, episode]);

  // lock the page behind while the watch page is open
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Esc closes
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (ev) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const moreItems = useMemo(
    () => similar.map((it) => ({ ...it, _type: it.media_type || (it.first_air_date ? "tv" : "movie") })),
    [similar]
  );

  if (!open) return null;

  const toggleSafe = () => {
    const next = !safe;
    setSafe(next);
    setLoading(true);
    try { localStorage.setItem(SAFE_KEY, next ? "on" : "off"); } catch { /* ignore */ }
  };

  const openTitle = (it) => {
    navigate(`/title/${it._type}/${it.id}`, { state: { autoplay: true } });
  };

  const sameSeason = pageSeason === s;
  const lastEp = sameSeason && episodes.length ? episodes[episodes.length - 1].episode_number : null;
  const goEp = (n) => onEpisodeChange && onEpisodeChange(s, n);

  const episodesBlock = tv && (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-display font-bold text-lg">Episodes</h2>
        {seasons.length > 1 && (
          <select
            value={pageSeason}
            onChange={(ev) => onSeasonChange && onSeasonChange(Number(ev.target.value))}
            aria-label="Season"
            className="h-9 rounded-full bg-white/5 border border-border/60 px-3 text-sm"
          >
            {seasons.map((x) => (
              <option key={x.id} value={x.season_number} className="bg-card">{x.name || `Season ${x.season_number}`}</option>
            ))}
          </select>
        )}
      </div>
      <div className="space-y-2 lg:max-h-[70vh] lg:overflow-y-auto no-scrollbar pr-0.5">
        {episodes.length === 0 && <div className="text-sm text-muted-foreground">Loading episodes…</div>}
        {episodes.map((ep) => {
          const playing = sameSeason && ep.episode_number === e;
          return (
            <button
              key={ep.id}
              onClick={() => onEpisodeChange && onEpisodeChange(pageSeason, ep.episode_number)}
              className={`w-full flex gap-3 p-2 rounded-xl text-left border transition ${playing ? "bg-primary/15 border-primary/60" : "bg-card border-border/60 hover:bg-white/5"}`}
            >
              <div className="relative shrink-0 w-28 aspect-video rounded-lg overflow-hidden bg-muted">
                {ep.still_path && <img src={imageUrl(ep.still_path, "w300")} alt="" loading="lazy" className="w-full h-full object-cover" />}
                {playing && <span className="absolute inset-0 flex items-center justify-center bg-black/50"><Play className="w-5 h-5 fill-white text-white" /></span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium line-clamp-1"><span className="text-primary mr-1.5">E{ep.episode_number}</span>{ep.name}</div>
                {ep.overview && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ep.overview}</p>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );

  const moreList = moreItems.length > 0 && !tv && (
    <section className="hidden lg:block">
      <h2 className="font-display font-bold text-lg mb-3">More like this</h2>
      <div className="space-y-2 max-h-[75vh] overflow-y-auto no-scrollbar pr-0.5">
        {moreItems.map((it) => (
          <button key={`${it._type}-${it.id}`} onClick={() => openTitle(it)} className="w-full flex gap-3 p-2 rounded-xl bg-card border border-border/60 hover:bg-white/5 text-left transition">
            <img src={imageUrl(it.poster_path, "w185")} alt="" loading="lazy" className="w-14 aspect-[2/3] rounded-md object-cover bg-muted shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium line-clamp-2">{it.title || it.name}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                {it.vote_average > 0 && <span className="flex items-center gap-0.5 text-foreground"><Star className="w-3 h-3 fill-primary text-primary" />{Math.round(it.vote_average * 10) / 10}</span>}
                <span>{(it.release_date || it.first_air_date || "").slice(0, 4)}</span>
                <span>{it._type === "tv" ? "Series" : "Movie"}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );

  const moreGrid = moreItems.length > 0 && (
    <section className={tv ? "" : "lg:hidden"}>
      <h2 className="font-display font-bold text-lg mb-3">More like this</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3">
        {moreItems.map((it) => (
          <button key={`${it._type}-${it.id}`} onClick={() => openTitle(it)} className="text-left group">
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted">
              <img src={imageUrl(it.poster_path, "w342")} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            </div>
            <div className="text-xs mt-1.5 line-clamp-2 font-medium">{it.title || it.name}</div>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-y-auto pt-safe pb-safe">
      {/* top bar */}
      <div className="sticky top-0 z-20 h-14 flex items-center gap-3 px-3 sm:px-6 glass-strong border-b border-border/60">
        <button onClick={onClose} aria-label="Back" className="w-10 h-10 shrink-0 rounded-full bg-white/10 border border-white/15 flex items-center justify-center hover:bg-white/15 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 text-sm">
          <div className="font-semibold truncate">{title}</div>
          {tv && <div className="text-xs text-muted-foreground">Season {s} · Episode {e}</div>}
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-0 sm:px-4 lg:px-6 py-0 sm:py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
        {/* ---------- left: player + info ---------- */}
        <div className="min-w-0">
          <div className="relative w-full aspect-video bg-black sm:rounded-xl overflow-hidden">
            {loading && !failedAll && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground pointer-events-none">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm">Loading stream…</span>
              </div>
            )}
            {failedAll ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                <span className="text-sm text-muted-foreground">Couldn't load the stream right now.</span>
                <button onClick={retry} className="h-9 px-5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 transition">Try again</button>
              </div>
            ) : (
            <iframe
              key={`${src}|${safe}`}
              src={src}
              title={title}
              allowFullScreen
              referrerPolicy="origin"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              sandbox={safe ? SANDBOX : undefined}
              className="absolute inset-0 w-full h-full"
              style={{ border: 0 }}
              onLoad={() => { setLoading(false); onLoad(); }}
            />
            )}
          </div>

          {/* controls under the player */}
          <div className={`px-3 sm:px-0 flex flex-wrap items-center gap-2 ${tv ? "pt-3" : ""}`}>
            {tv && (
              <>
                <button onClick={() => goEp(e - 1)} disabled={e <= 1} className="h-9 px-3 rounded-full bg-white/10 border border-white/15 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none hover:bg-white/15 transition">
                  <SkipBack className="w-4 h-4" /> Prev
                </button>
                <button onClick={() => goEp(e + 1)} disabled={lastEp !== null && e >= lastEp} className="h-9 px-3 rounded-full bg-white/10 border border-white/15 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none hover:bg-white/15 transition">
                  Next <SkipForward className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          <div className="px-3 sm:px-0 pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <button onClick={toggleSafe} aria-pressed={safe} title="Stops the player from redirecting this page. Turn it off if a server refuses to play." className="flex items-center gap-1 hover:text-foreground transition">
              <ShieldCheck className="w-3.5 h-3.5" /> Block redirects: {safe ? "On" : "Off"}
            </button>
          </div>

          {/* info */}
          <div className="px-3 sm:px-0 pt-5">
            <h1 className="font-display font-bold text-xl sm:text-2xl leading-tight">{title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1.5">
              {rating > 0 && <span className="flex items-center gap-1 text-foreground"><Star className="w-4 h-4 fill-primary text-primary" />{Math.round(rating * 10) / 10}</span>}
              {year && <span>{year}</span>}
              <span className="uppercase text-xs tracking-wide">{tv ? "Series" : "Movie"}</span>
            </div>
            {overview && <p className="text-sm text-muted-foreground leading-relaxed mt-3 max-w-3xl">{overview}</p>}
          </div>

          {/* small screens: episodes + more like this stack under the info */}
          <div className="px-3 sm:px-0 pt-8 pb-10 space-y-8">
            {tv && <div className="lg:hidden">{episodesBlock}</div>}
            {moreGrid}
          </div>
        </div>

        {/* ---------- right (desktop): episodes or more like this ---------- */}
        <aside className="hidden lg:block min-w-0 pb-10">
          {tv ? episodesBlock : moreList}
        </aside>
      </div>
    </div>
  );
}
