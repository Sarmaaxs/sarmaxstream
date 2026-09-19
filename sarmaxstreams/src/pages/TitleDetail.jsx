import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Play, Star, Clock, Calendar } from "lucide-react";
import Navbar from "@/components/Navbar";
import BackButton from "@/components/BackButton";
import WatchlistButton from "@/components/WatchlistButton";
import VideoPlayer from "@/components/VideoPlayer";
import MovieRow from "@/components/MovieRow";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tmdbDetails, tmdbSeason, backdropUrl, imageUrl } from "@/lib/tmdb";

export default function TitleDetail() {
  const { type, id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [season, setSeason] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [player, setPlayer] = useState({ open: false, season: null, episode: null });

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const d = await tmdbDetails(type, id);
        if (!active) return;
        setData(d);
        if (type === "tv" && d?.seasons?.length) {
          const firstReal = d.seasons.find((s) => s.season_number > 0) || d.seasons[0];
          setSeason(firstReal?.season_number || 1);
        }
      } catch (e) {
        setError(e.message || "Failed to load");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [type, id]);

  useEffect(() => {
    if (type !== "tv" || !data) return;
    let active = true;
    (async () => {
      setSeasonLoading(true);
      try {
        const s = await tmdbSeason(id, season);
        if (!active) return;
        setEpisodes(s?.episodes || []);
      } catch {
        if (active) setEpisodes([]);
      } finally {
        if (active) setSeasonLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [type, id, season, data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <BackButton />
        <div className="pt-nav px-6">
          <div className="h-72 rounded-2xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <BackButton />
        <div className="pt-[calc(8rem+env(safe-area-inset-top,0px))] text-center text-muted-foreground">{error || "Title not found."}</div>
      </div>
    );
  }

  const title = data.title || data.name;
  const year = (data.release_date || data.first_air_date || "").slice(0, 4);
  const runtime = data.runtime || (data.episode_run_time && data.episode_run_time[0]);
  const cast = (data.credits?.cast || []).slice(0, 12);
  const similar = (data.similar?.results || []).filter((r) => r.poster_path).slice(0, 20);
  const seasons = (data.seasons || []).filter((s) => s.season_number > 0 || s.season_number === 0 && s.episode_count > 0);

  const play = () => {
    if (type === "tv") {
      const ep = episodes[0]?.episode_number || 1;
      setPlayer({ open: true, season, episode: ep });
    } else {
      setPlayer({ open: true, season: null, episode: null });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />
      <div className="relative h-[52vh] min-h-[360px] w-full overflow-hidden">
        {backdropUrl(data.backdrop_path) && (
          <img src={backdropUrl(data.backdrop_path, "original")} alt={title} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />
      </div>

      <div className="relative -mt-48 z-10 mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-page">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="shrink-0 w-40 sm:w-52 aspect-[2/3] rounded-xl overflow-hidden bg-card border border-border/60 shadow-2xl">
            {imageUrl(data.poster_path, "w500") && (
              <img src={imageUrl(data.poster_path, "w500")} alt={title} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 pt-2">
            <h1 className="font-display font-bold tracking-tight text-balance leading-tight mb-3"
                style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
              {data.vote_average > 0 && (
                <span className="flex items-center gap-1 text-foreground">
                  <Star className="w-4 h-4 fill-primary text-primary" />
                  {Math.round(data.vote_average * 10) / 10}/10
                </span>
              )}
              {year && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> {year}
                </span>
              )}
              {runtime ? (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {runtime}m
                </span>
              ) : null}
              <span className="uppercase text-xs tracking-wide">
                {type === "tv" ? "Series" : "Movie"}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 mb-5">
              <button
                onClick={play}
                className="flex items-center gap-2 h-12 px-7 rounded-full bg-primary text-primary-foreground font-semibold hover:brightness-110 transition"
              >
                <Play className="w-5 h-5 fill-primary-foreground" />
                {type === "tv" ? "Play First Episode" : "Play"}
              </button>
              <WatchlistButton
                item={{ id: data.id, media_type: type, title, poster_path: data.poster_path, backdrop_path: data.backdrop_path }}
              />
            </div>

            {data.genres?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {data.genres.map((g) => (
                  <Link
                    key={g.id}
                    to={`/search?genre=${type}`}
                    className="px-3 h-8 inline-flex items-center rounded-full bg-white/5 border border-border/60 text-xs hover:bg-white/10 transition"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            )}

            <p className="text-muted-foreground leading-relaxed max-w-3xl">{data.overview}</p>
          </div>
        </div>

        {type === "tv" && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-xl">Episodes</h2>
              <Select value={String(season)} onValueChange={(v) => setSeason(Number(v))}>
                <SelectTrigger
                  aria-label="Select season"
                  className="h-10 w-auto min-w-[10rem] gap-3 rounded-full border-border/60 bg-white/5 px-4 text-sm shadow-none focus:ring-2 focus:ring-primary/60"
                >
                  <SelectValue placeholder="Season" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60">
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={String(s.season_number)}>
                      {s.name || `Season ${s.season_number}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              {seasonLoading ? (
                <div className="text-muted-foreground text-sm">Loading episodes…</div>
              ) : episodes.length === 0 ? (
                <div className="text-muted-foreground text-sm">No episodes found for this season.</div>
              ) : (
                episodes.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => setPlayer({ open: true, season, episode: ep.episode_number })}
                    className="w-full text-left flex gap-4 p-3 rounded-xl bg-card hover:bg-card/70 border border-border/60 transition group"
                  >
                    <div className="relative shrink-0 w-40 sm:w-56 aspect-video rounded-lg overflow-hidden bg-muted">
                      {ep.still_path ? (
                        <img src={imageUrl(ep.still_path, "w500")} alt={ep.name} className="w-full h-full object-cover" />
                      ) : null}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
                        <span className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Play className="w-5 h-5 fill-primary-foreground" />
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-primary font-semibold text-sm">E{ep.episode_number}</span>
                        <span className="font-medium line-clamp-1">{ep.name}</span>
                      </div>
                      {ep.air_date && <div className="text-xs text-muted-foreground mb-1">{ep.air_date}</div>}
                      <p className="text-sm text-muted-foreground line-clamp-2">{ep.overview}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {cast.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display font-bold text-xl mb-4">Cast</h2>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {cast.map((c) => (
                <div key={c.id} className="shrink-0 w-24 text-center">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-muted mb-2">
                    {c.profile_path ? (
                      <img src={imageUrl(c.profile_path, "w185")} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        {c.name?.[0]}
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-medium line-clamp-1">{c.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{c.character}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {similar.length > 0 && <MovieRow title="More Like This" items={similar} loading={false} />}
      </div>

      <VideoPlayer
        open={player.open}
        onClose={() => setPlayer((p) => ({ ...p, open: false }))}
        mediaType={type}
        tmdbId={id}
        title={title}
        poster={data.poster_path}
        backdrop={data.backdrop_path}
        season={player.season}
        episode={player.episode}
      />
    </div>
  );
}
