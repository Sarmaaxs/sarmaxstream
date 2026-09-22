import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Play, Star, Clock, Calendar } from "lucide-react";
import Navbar from "@/components/Navbar";
import BackButton from "@/components/BackButton";
import WatchlistButton from "@/components/WatchlistButton";
import MovieRow from "@/components/MovieRow";
import AnimePlayer, { AudioToggle } from "@/components/AnimePlayer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { animeDetails, animeEpisodes, animeRecommendations } from "@/lib/anime";

const PAGE_SIZE = 100; // Jikan returns 100 episodes per page
const AUDIO_KEY = "sarmaxstream:anime-audio";

function readAudio() {
  try {
    return localStorage.getItem(AUDIO_KEY) === "dub" ? "dub" : "sub";
  } catch {
    return "sub";
  }
}

export default function AnimeDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [audio, setAudio] = useState(readAudio);
  const [range, setRange] = useState(0); // which block of 100 episodes
  const [eps, setEps] = useState([]);
  const [pageCount, setPageCount] = useState(1);
  const [epsLoading, setEpsLoading] = useState(false);
  const [similar, setSimilar] = useState([]);
  const [player, setPlayer] = useState({ open: false, episode: 1 });

  const changeAudio = (a) => {
    setAudio(a);
    try {
      localStorage.setItem(AUDIO_KEY, a);
    } catch {
      /* ignore */
    }
  };

  // Load the anime details.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    setRange(0);
    setEps([]);
    setSimilar([]);
    setPlayer({ open: false, episode: 1 });
    (async () => {
      try {
        const d = await animeDetails(id);
        if (!active) return;
        setData(d);
        setPageCount(Math.max(1, Math.ceil((d.episodes || 0) / PAGE_SIZE)));
        animeRecommendations(id)
          .then((r) => active && setSimilar(r))
          .catch(() => {});
      } catch (e) {
        if (active) setError(e.message || "Failed to load");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // Load the episode list for the selected block of 100.
  useEffect(() => {
    if (!data || data.type === "Movie") return;
    let active = true;
    setEpsLoading(true);
    setEps([]);
    animeEpisodes(id, range + 1)
      .then(({ episodes, lastPage }) => {
        if (!active) return;
        setEps(episodes);
        if (lastPage) setPageCount(lastPage);
      })
      .catch(() => {
        if (active) setEps([]);
      })
      .finally(() => {
        if (active) setEpsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, data, range]);

  const total = data?.episodes || null;

  // If Jikan has no episode list, fall back to numbered episodes 1..N.
  const list = useMemo(() => {
    if (!data) return [];
    if (data.type === "Movie") return [{ number: 1, title: data.title }];
    if (eps.length) return eps;
    if (epsLoading) return [];
    const start = range * PAGE_SIZE + 1;
    const end = total ? Math.min(total, start + PAGE_SIZE - 1) : 0;
    const out = [];
    for (let n = start; n <= end; n++) out.push({ number: n, title: `Episode ${n}` });
    return out;
  }, [data, eps, epsLoading, range, total]);

  const rangeOptions = useMemo(
    () =>
      Array.from({ length: Math.min(pageCount, 60) }, (_, i) => {
        const start = i * PAGE_SIZE + 1;
        const end = total ? Math.min((i + 1) * PAGE_SIZE, total) : (i + 1) * PAGE_SIZE;
        return { value: String(i), label: `${start}–${end}` };
      }),
    [pageCount, total]
  );

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
        <div className="pt-[calc(8rem+env(safe-area-inset-top,0px))] text-center text-muted-foreground">
          {error || "Anime not found."}
        </div>
      </div>
    );
  }

  const title = data.title;
  const isMovie = data.type === "Movie";
  const allRelated = (data.relations || []).flatMap((r) =>
    (r.entry || [])
      .filter((e) => e.type === "anime")
      .map((e) => ({ relation: r.relation, rawType: r.rawType, id: e.mal_id, name: e.name }))
  );
  // Other seasons (prequel/sequel chain) shown separately from movies/side-stories/spin-offs.
  const seasons = allRelated.filter((r) => r.rawType === "PREQUEL" || r.rawType === "SEQUEL");
  const related = allRelated.filter((r) => r.rawType !== "PREQUEL" && r.rawType !== "SEQUEL");

  const playEp = (n) => setPlayer({ open: true, episode: n });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />

      <div className="relative h-[52vh] min-h-[360px] w-full overflow-hidden">
        {data.backdrop_path && (
          <img
            src={data.backdrop_path}
            alt={title}
            className={`w-full h-full object-cover ${
              data.backdrop_is_poster ? "blur-2xl scale-125 opacity-60" : ""
            }`}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />
      </div>

      <div className="relative -mt-48 z-10 mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-page">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="shrink-0 w-40 sm:w-52 aspect-[2/3] rounded-xl overflow-hidden bg-card border border-border/60 shadow-2xl">
            {data.poster_path && (
              <img src={data.poster_path} alt={title} className="w-full h-full object-cover" />
            )}
          </div>

          <div className="flex-1 pt-2">
            <h1
              className="font-display font-bold tracking-tight text-balance leading-tight mb-1"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
            >
              {title}
            </h1>
            {data.japanese_title && (
              <div className="text-sm text-muted-foreground mb-3">{data.japanese_title}</div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
              {data.vote_average > 0 && (
                <span className="flex items-center gap-1 text-foreground">
                  <Star className="w-4 h-4 fill-primary text-primary" />
                  {Math.round(data.vote_average * 10) / 10}/10
                </span>
              )}
              {data.release_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> {data.release_date}
                </span>
              )}
              {data.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {data.duration.replace(" per ep", "")}
                </span>
              )}
              <span className="uppercase text-xs tracking-wide">{data.type || "Anime"}</span>
              {data.status && <span className="text-xs">{data.status}</span>}
              {total && !isMovie && <span className="text-xs">{total} episodes</span>}
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-5">
              <button
                onClick={() => playEp(1)}
                className="flex items-center gap-2 h-12 px-7 rounded-full bg-primary text-primary-foreground font-semibold hover:brightness-110 transition"
              >
                <Play className="w-5 h-5 fill-primary-foreground" />
                {isMovie ? "Play" : "Play Episode 1"}
              </button>
              <WatchlistButton
                item={{
                  id: data.id,
                  media_type: "anime",
                  title,
                  poster_path: data.poster_path,
                  backdrop_path: data.backdrop_path,
                  overview: data.overview,
                  release_date: data.release_date,
                  vote_average: data.vote_average,
                }}
              />
              <AudioToggle value={audio} onChange={changeAudio} />
            </div>

            {data.genres?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {data.genres.map((g) => (
                  <span
                    key={g}
                    className="px-3 h-8 inline-flex items-center rounded-full bg-white/5 border border-border/60 text-xs"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            <p className="text-muted-foreground leading-relaxed max-w-3xl">{data.overview}</p>
            {data.studios?.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">Studio: {data.studios.join(", ")}</p>
            )}
          </div>
        </div>

        {/* Episodes */}
        {!isMovie && (
          <div className="mt-12">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-display font-bold text-xl">Episodes</h2>
              {rangeOptions.length > 1 && (
                <Select value={String(range)} onValueChange={(v) => setRange(Number(v))}>
                  <SelectTrigger
                    aria-label="Select episode range"
                    className="h-10 w-auto min-w-[9rem] gap-3 rounded-full border-border/60 bg-white/5 px-4 text-sm shadow-none focus:ring-2 focus:ring-primary/60"
                  >
                    <SelectValue placeholder="Episodes" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60">
                    {rangeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {epsLoading ? (
              <div className="text-muted-foreground text-sm">Loading episodes…</div>
            ) : list.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No episodes listed yet for this title.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {list.map((ep) => (
                  <button
                    key={ep.number}
                    onClick={() => playEp(ep.number)}
                    className="w-full text-left flex items-center gap-4 p-3 rounded-xl bg-card hover:bg-card/70 border border-border/60 transition group"
                  >
                    <span className="shrink-0 w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center font-semibold text-primary">
                      {ep.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium line-clamp-1">
                        {ep.title || `Episode ${ep.number}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ep.aired ? ep.aired.slice(0, 10) : ""}
                        {ep.filler ? " • Filler" : ""}
                        {ep.recap ? " • Recap" : ""}
                      </div>
                    </div>
                    <Play className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-primary transition" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Other seasons */}
        {seasons.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display font-bold text-xl mb-4">Seasons</h2>
            <div className="flex flex-wrap gap-2">
              {seasons.map((r) => (
                <Link
                  key={`${r.relation}-${r.id}`}
                  to={`/title/anime/${r.id}`}
                  className={`px-4 py-2 rounded-full border text-sm transition ${
                    String(r.id) === String(data.id)
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "bg-white/5 border-border/60 hover:bg-white/10"
                  }`}
                >
                  <span className="text-xs mr-2 opacity-70">{r.relation}</span>
                  {r.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Movies / side stories / spin-offs */}
        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display font-bold text-xl mb-4">Related</h2>
            <div className="flex flex-wrap gap-2">
              {related.slice(0, 16).map((r) => (
                <Link
                  key={`${r.relation}-${r.id}`}
                  to={`/title/anime/${r.id}`}
                  className="px-4 py-2 rounded-full bg-white/5 border border-border/60 text-sm hover:bg-white/10 transition"
                >
                  <span className="text-muted-foreground text-xs mr-2">{r.relation}</span>
                  {r.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {similar.length > 0 && <MovieRow title="More Like This" items={similar} loading={false} />}
      </div>

      <AnimePlayer
        open={player.open}
        onClose={() => setPlayer((p) => ({ ...p, open: false }))}
        malId={data.id}
        title={title}
        poster={data.poster_path}
        backdrop={data.backdrop_path}
        episode={player.episode}
        totalEpisodes={isMovie ? 1 : total}
        audio={audio}
        onAudioChange={changeAudio}
        onEpisodeChange={(n) => setPlayer((p) => ({ ...p, episode: n }))}
      />
    </div>
  );
}