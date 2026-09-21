// ---------------------------------------------------------------------------
// Anime helpers  (Jikan is NOT used anymore - it has been down since Aug 28)
//
//  - LISTS + SEARCH ........ TMDB (same API your movies use)
//  - MAL id, details, episodes, related, recommendations ... AniList (free, no key)
//  - PLAYBACK .............. YOUR source, which needs a MyAnimeList (MAL) id:
//        https://vidlink.pro/anime/{MALid}/{number}/{sub|dub}
//
// AniList returns the MAL id as `idMal`, so all the /title/anime/:id links keep
// using MAL ids exactly like before.
// ---------------------------------------------------------------------------

import { tmdb } from "@/lib/tmdb";

// >>> Change these two lines if your source changes <<<
export const ANIME_STREAM_BASE = "https://vidlink.pro/anime";
export const AUDIO_OPTIONS = ["sub", "dub"]; // exact values your source expects

export function animeStreamUrl(malId, episode = 1, audio = "sub") {
  const a = AUDIO_OPTIONS.includes(audio) ? audio : AUDIO_OPTIONS[0];
  return `${ANIME_STREAM_BASE}/${encodeURIComponent(malId)}/${encodeURIComponent(episode)}/${a}`;
}

// ------------------------- TMDB anime detection ----------------------------
// TMDB has no "anime" flag. Anime = genre "Animation" (16) + original language Japanese.

const ANIME_GENRE = 16;

function genreIds(item) {
  if (Array.isArray(item?.genre_ids)) return item.genre_ids;
  if (Array.isArray(item?.genres)) return item.genres.map((g) => g.id);
  return [];
}

export function isTmdbAnime(item) {
  return genreIds(item).includes(ANIME_GENRE) && item?.original_language === "ja";
}

// If a TMDB movie/tv item is really anime, returns "anime-tv" / "anime-movie".
// Cards use this as the URL type so clicking goes to the ANIME page,
// not the normal movie player. Returns null for everything else.
export function animeCardType(item) {
  if (!item) return null;
  const t = item.media_type || (item.first_air_date ? "tv" : "movie");
  if ((t === "tv" || t === "movie") && isTmdbAnime(item)) return `anime-${t}`;
  return null;
}

function mapTmdb(results, kindOf) {
  const seen = new Set();
  const items = [];
  for (const r of results || []) {
    if (!r?.id || !r.poster_path || seen.has(r.id)) continue;
    seen.add(r.id);
    items.push({ ...r, media_type: `anime-${kindOf(r)}` });
  }
  return items;
}

const isoDay = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

// kind: "airing" | "popular" | "top" | "movies"
export async function animeList(kind = "airing", page = 1) {
  const base = {
    with_genres: ANIME_GENRE,
    with_original_language: "ja",
    include_adult: false,
    page,
  };
  let path = "discover/tv";
  let params;
  switch (kind) {
    case "popular":
      params = { ...base, sort_by: "popularity.desc" };
      break;
    case "top":
      params = { ...base, sort_by: "vote_average.desc", "vote_count.gte": 200 };
      break;
    case "movies":
      path = "discover/movie";
      params = { ...base, sort_by: "popularity.desc" };
      break;
    case "airing":
    default:
      params = {
        ...base,
        sort_by: "popularity.desc",
        "air_date.gte": isoDay(-14),
        "air_date.lte": isoDay(7),
      };
  }
  const data = await tmdb(path, params);
  const media = path === "discover/movie" ? "movie" : "tv";
  return {
    items: mapTmdb(data?.results, () => media),
    hasNext: page < Math.min(data?.total_pages || 1, 500),
  };
}

export async function animeSearch(query, page = 1) {
  // TMDB search mixes everything, so grab 2 TMDB pages per app page and keep only anime.
  const p1 = page * 2 - 1;
  const [a, b] = await Promise.all([
    tmdb("search/multi", { query, page: p1, include_adult: false }),
    tmdb("search/multi", { query, page: p1 + 1, include_adult: false }).catch(() => null),
  ]);
  const raw = [...(a?.results || []), ...(b?.results || [])].filter(
    (r) => (r.media_type === "tv" || r.media_type === "movie") && isTmdbAnime(r)
  );
  const total = Math.min(a?.total_pages || 1, 500);
  return { items: mapTmdb(raw, (r) => r.media_type), hasNext: p1 + 1 < total };
}

// ------------------------- AniList client ----------------------------------
// - Browsers send a Referer automatically, which AniList requires.
// - Results are cached (10 min fresh), retried on failure, and if AniList is
//   unreachable we fall back to the last saved copy (up to 7 days old).

const ANILIST = "https://graphql.anilist.co";
const FRESH_MS = 10 * 60 * 1000;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;
const ATTEMPT_TIMEOUT_MS = 10000;
const RETRY_DELAYS = [0, 1000, 2500];
const LS_PREFIX = "anilist:";

const mem = new Map();
const inflight = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function lsGet(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsSet(key, entry) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry));
  } catch {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(LS_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry));
    } catch {
      /* give up silently */
    }
  }
}

async function fetchGql(query, variables) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const res = await fetch(ANILIST, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || !json.data) {
      const err = new Error(json?.errors?.[0]?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.retryAfter = Number(res.headers.get("Retry-After")) || 0;
      throw err;
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

// name + variables make the cache key; query is the GraphQL text.
async function gql(name, query, variables = {}) {
  const key = `${name}:${JSON.stringify(variables)}`;

  const m = mem.get(key);
  if (m && Date.now() - m.t < FRESH_MS) return m.data;
  const saved = lsGet(key);
  if (saved && Date.now() - saved.t < FRESH_MS) {
    mem.set(key, saved);
    return saved.data;
  }

  if (inflight.has(key)) return inflight.get(key);

  const run = async () => {
    let extraWait = 0;
    for (let i = 0; i < RETRY_DELAYS.length; i++) {
      const wait = Math.max(RETRY_DELAYS[i], extraWait);
      if (wait) await sleep(wait);
      extraWait = 0;
      try {
        const data = await fetchGql(query, variables);
        const entry = { t: Date.now(), data };
        mem.set(key, entry);
        lsSet(key, entry);
        return data;
      } catch (e) {
        if (e.status === 400 || e.status === 404) throw new Error("Anime not found.");
        if (e.status === 429) extraWait = Math.min((e.retryAfter || 2) * 1000, 6000);
        // 403 / 5xx / timeout / network error -> try again
      }
    }

    const old = mem.get(key) || lsGet(key);
    if (old && Date.now() - old.t < STALE_MS) {
      console.warn("AniList unavailable, showing saved data for", key);
      return old.data;
    }
    throw new Error("Anime service is busy. Please try again.");
  };

  const p = run().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ------------------------- TMDB id -> MAL id -------------------------------

const SEARCH_QUERY = `
query ($search: String) {
  Page(page: 1, perPage: 10) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      idMal
      title { romaji english native }
      synonyms
      format
      startDate { year }
      popularity
    }
  }
}`;

const MAP_KEY = "sarmaxstream:mal-map";

function readMap() {
  try {
    return JSON.parse(localStorage.getItem(MAP_KEY)) || {};
  } catch {
    return {};
  }
}

function saveMap(key, malId) {
  try {
    const m = readMap();
    m[key] = malId;
    localStorage.setItem(MAP_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function scoreCandidate(m, wanted, kind, year) {
  const names = [m.title?.romaji, m.title?.english, m.title?.native, ...(m.synonyms || [])]
    .filter(Boolean)
    .map(norm);

  let s = 0;
  if (wanted.some((w) => names.includes(w))) s += 100;
  else if (
    wanted.some((w) => w.length >= 4 && names.some((n) => n.startsWith(w) || w.startsWith(n)))
  )
    s += 40;

  const f = m.format;
  if (kind === "movie") s += f === "MOVIE" ? 20 : -20;
  else if (f === "TV" || f === "TV_SHORT") s += 20;
  else if (f === "ONA") s += 10;
  else if (f === "MOVIE") s -= 20;
  else s -= 5;

  const ay = m.startDate?.year;
  if (year && ay) {
    const d = Math.abs(ay - year);
    s += d === 0 ? 30 : d === 1 ? 15 : d <= 3 ? 0 : -10;
  }
  s += Math.min(5, (m.popularity || 0) / 50000); // tie-breaker: the more popular entry
  return s;
}

// kind: "tv" | "movie"  (the TMDB type).  Returns the MAL id, or throws.
export async function animeFindMalId(kind, tmdbId) {
  const key = `${kind}:${tmdbId}`;
  const known = readMap()[key];
  if (known) return known;

  const d = await tmdb(`${kind}/${tmdbId}`);
  const names = [...new Set([d.name || d.title, d.original_name || d.original_title].filter(Boolean))];
  const wanted = names.map(norm);
  const year = parseInt((d.first_air_date || d.release_date || "").slice(0, 4), 10) || null;

  for (const q of names) {
    const data = await gql("search", SEARCH_QUERY, { search: q });
    let best = null;
    for (const m of data?.Page?.media || []) {
      if (!m.idMal) continue;
      const s = scoreCandidate(m, wanted, kind, year);
      if (!best || s > best.s) best = { m, s };
    }
    if (best && best.s >= 60) {
      saveMap(key, best.m.idMal);
      return best.m.idMal;
    }
  }
  throw new Error("Couldn't find this title on the anime source.");
}

// ------------------------- AniList details ---------------------------------

const DETAIL_QUERY = `
query ($id: Int) {
  Media(idMal: $id, type: ANIME) {
    idMal
    title { romaji english native }
    format
    status
    episodes
    duration
    genres
    averageScore
    description(asHtml: false)
    startDate { year }
    seasonYear
    coverImage { extraLarge large }
    bannerImage
    studios(isMain: true) { nodes { name } }
    nextAiringEpisode { episode }
    streamingEpisodes { title }
    relations {
      edges {
        relationType(version: 2)
        node { idMal type title { romaji english } }
      }
    }
    recommendations(sort: RATING_DESC, perPage: 20) {
      nodes {
        mediaRecommendation {
          idMal
          title { romaji english }
          description(asHtml: false)
          coverImage { extraLarge large }
          bannerImage
          averageScore
          startDate { year }
        }
      }
    }
  }
}`;

const stripHtml = (s) =>
  (s || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();

const FORMAT = { TV: "TV", TV_SHORT: "TV", MOVIE: "Movie", SPECIAL: "Special", OVA: "OVA", ONA: "ONA", MUSIC: "Music" };
const STATUS = {
  FINISHED: "Finished Airing",
  RELEASING: "Currently Airing",
  NOT_YET_RELEASED: "Not yet aired",
  CANCELLED: "Cancelled",
  HIATUS: "On Hiatus",
};
const prettyRelation = (r) =>
  (r || "")
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// Convert an AniList media object into the same shape the app uses for TMDB
// items, so MovieCard / MovieRow / PosterGrid / Watchlist all just work.
// NOTE: `id` is the MAL id (that's what the anime player needs).
export function normalizeAnime(m) {
  const poster = m.coverImage?.extraLarge || m.coverImage?.large || "";
  const title = m.title?.english || m.title?.romaji || "Untitled";
  const year = m.startDate?.year || m.seasonYear || "";
  return {
    id: m.idMal,
    media_type: "anime",
    title,
    name: title,
    poster_path: poster,
    backdrop_path: m.bannerImage || poster,
    backdrop_is_poster: !m.bannerImage,
    overview: stripHtml(m.description),
    release_date: year ? String(year) : "",
    vote_average: m.averageScore ? m.averageScore / 10 : 0,
  };
}

async function getMedia(malId) {
  const data = await gql("detail", DETAIL_QUERY, { id: Number(malId) });
  if (!data?.Media) throw new Error("Anime not found.");
  return data.Media;
}

export async function animeDetails(id) {
  const m = await getMedia(id);

  // How many episodes to show: total if known, else however many have aired so far.
  const aired = m.nextAiringEpisode?.episode ? m.nextAiringEpisode.episode - 1 : null;
  const isMovie = m.format === "MOVIE";
  const episodes = isMovie ? 1 : m.episodes || aired || null;

  // Same shape the detail page expects: [{ relation, entry: [{ type, mal_id, name }] }]
  const relations = (m.relations?.edges || [])
    .filter((e) => e.node?.type === "ANIME" && e.node.idMal)
    .map((e) => ({
      relation: prettyRelation(e.relationType),
      entry: [
        {
          type: "anime",
          mal_id: e.node.idMal,
          name: e.node.title?.english || e.node.title?.romaji || "Untitled",
        },
      ],
    }));

  return {
    ...normalizeAnime(m),
    japanese_title: m.title?.native || "",
    type: FORMAT[m.format] || "",
    episodes,
    status: STATUS[m.status] || "",
    duration: m.duration ? `${m.duration} min` : "",
    genres: m.genres || [],
    studios: (m.studios?.nodes || []).map((s) => s.name),
    relations,
  };
}

// 100 episodes per page (page 1 = episodes 1-100, page 2 = 101-200, ...)
export async function animeEpisodes(id, page = 1) {
  const m = await getMedia(id);
  const aired = m.nextAiringEpisode?.episode ? m.nextAiringEpisode.episode - 1 : null;
  const total = m.format === "MOVIE" ? 1 : m.episodes || aired || 0;

  // Episode titles, when AniList has them ("Episode 5 - Title")
  const titles = {};
  for (const s of m.streamingEpisodes || []) {
    const match = /^Episode\s+(\d+)\s*[-–:]\s*(.+)$/i.exec(s.title || "");
    if (match) titles[Number(match[1])] = match[2];
  }

  const start = (page - 1) * 100 + 1;
  const end = Math.min(total, page * 100);
  const episodes = [];
  for (let n = start; n <= end; n++) {
    episodes.push({ number: n, title: titles[n] || `Episode ${n}`, aired: "", filler: false, recap: false });
  }
  return { episodes, lastPage: Math.max(1, Math.ceil(total / 100)) };
}

export async function animeRecommendations(id) {
  const m = await getMedia(id);
  return (m.recommendations?.nodes || [])
    .map((n) => n.mediaRecommendation)
    .filter((r) => r?.idMal)
    .slice(0, 20)
    .map(normalizeAnime);
}