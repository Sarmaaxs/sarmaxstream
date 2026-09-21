// ---------------------------------------------------------------------------
// Anime helpers
//  - LISTS + SEARCH come from TMDB (same reliable API your movies use).
//  - The anime PLAYER needs a MyAnimeList (MAL) id, and TMDB doesn't have those.
//    So when someone opens an anime we look up its MAL id once (via Jikan),
//    remember it, and send them to the anime page (sub/dub player).
//  - Anime DETAILS + EPISODES still come from Jikan (through /api/jikan proxy,
//    with cache + retries + saved fallback).
//  - Playback comes from YOUR source:
//      https://vidlink.pro/anime/{MALid}/{number}/{subOrDub}
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

// ------------------------- TMDB id -> MAL id -------------------------------

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

function scoreCandidate(a, wanted, kind, year) {
  const names = [a.title, a.title_english, a.title_japanese, ...(a.titles || []).map((t) => t.title)]
    .filter(Boolean)
    .map(norm);

  let s = 0;
  if (wanted.some((w) => names.includes(w))) s += 100;
  else if (
    wanted.some((w) => w.length >= 4 && names.some((n) => n.startsWith(w) || w.startsWith(n)))
  )
    s += 40;

  if (kind === "movie") s += a.type === "Movie" ? 20 : -20;
  else if (a.type === "TV") s += 20;
  else if (a.type === "ONA") s += 10;
  else if (a.type === "Movie") s -= 20;
  else s -= 5;

  const ay = a.aired?.prop?.from?.year ?? a.year;
  if (year && ay) {
    const d = Math.abs(ay - year);
    s += d === 0 ? 30 : d === 1 ? 15 : d <= 3 ? 0 : -10;
  }
  s += Math.min(5, (a.members || 0) / 200000); // tie-breaker: the more popular entry
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
    const json = await jikan("anime", { q, limit: 10, sfw: true });
    let best = null;
    for (const a of json.data || []) {
      const s = scoreCandidate(a, wanted, kind, year);
      if (!best || s > best.s) best = { a, s };
    }
    if (best && best.s >= 60) {
      saveMap(key, best.a.mal_id);
      return best.a.mal_id;
    }
  }
  throw new Error("Couldn't find this title on the anime source.");
}

// ------------------------- Jikan (details / episodes) ----------------------
//
// How requests work (so a Jikan 504 doesn't break the site):
//   1. Memory / localStorage cache (fresh for 10 min)  -> instant, no request
//   2. Your Vercel proxy  /api/jikan  (CDN-cached)     -> preferred
//   3. Jikan directly                                  -> fallback
//   Each attempt has a timeout, and we retry up to 4 times with backoff.
//   4. If everything fails, show the last saved copy (up to 7 days old)
//      instead of an error. Only throw if there's nothing saved at all.

const JIKAN_DIRECT = "https://api.jikan.moe/v4";
const PROXY = "/api/jikan";

const FRESH_MS = 10 * 60 * 1000;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;
const ATTEMPT_TIMEOUT_MS = 12000;
const RETRY_DELAYS = [0, 800, 1600, 3000];
const LS_PREFIX = "jikan:";

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

async function fetchJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    // Local dev / proxy not deployed: /api/jikan returns index.html -> fall through to direct.
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) throw new Error("Not JSON");
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function jikan(path, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  const qsStr = qs.toString();
  const key = `${path}${qsStr ? `?${qsStr}` : ""}`;

  const m = mem.get(key);
  if (m && Date.now() - m.t < FRESH_MS) return m.data;
  const saved = lsGet(key);
  if (saved && Date.now() - saved.t < FRESH_MS) {
    mem.set(key, saved);
    return saved.data;
  }

  if (inflight.has(key)) return inflight.get(key);

  const proxyUrl = `${PROXY}?path=${encodeURIComponent(path)}${qsStr ? `&${qsStr}` : ""}`;
  const directUrl = `${JIKAN_DIRECT}/${path}${qsStr ? `?${qsStr}` : ""}`;

  const run = async () => {
    for (let i = 0; i < RETRY_DELAYS.length; i++) {
      if (RETRY_DELAYS[i]) await sleep(RETRY_DELAYS[i]);
      const url = i % 2 === 0 ? proxyUrl : directUrl;
      try {
        const json = await fetchJson(url);
        const entry = { t: Date.now(), data: json };
        mem.set(key, entry);
        lsSet(key, entry);
        return json;
      } catch (e) {
        if (e.status === 400 || e.status === 404) throw new Error("Anime not found.");
        // 429 / 5xx / timeout / network error -> try again
      }
    }

    const old = mem.get(key) || lsGet(key);
    if (old && Date.now() - old.t < STALE_MS) {
      console.warn("Jikan unavailable, showing saved data for", key);
      return old.data;
    }
    throw new Error("Anime service is busy. Please try again.");
  };

  const p = run().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// Convert a Jikan anime object into the same shape the app uses for TMDB
// items, so MovieCard / MovieRow / PosterGrid / Watchlist all just work.
export function normalizeAnime(a) {
  const poster =
    a.images?.jpg?.large_image_url ||
    a.images?.webp?.large_image_url ||
    a.images?.jpg?.image_url ||
    "";
  const trailerImg =
    a.trailer?.images?.maximum_image_url || a.trailer?.images?.large_image_url || "";
  const title = a.title_english || a.title || "Untitled";
  const year = a.aired?.from ? a.aired.from.slice(0, 4) : a.year ? String(a.year) : "";
  return {
    id: a.mal_id,
    media_type: "anime",
    title,
    name: title,
    poster_path: poster,
    backdrop_path: trailerImg || poster,
    backdrop_is_poster: !trailerImg,
    overview: a.synopsis || "",
    release_date: year,
    vote_average: a.score || 0,
  };
}

export async function animeDetails(id) {
  const json = await jikan(`anime/${encodeURIComponent(id)}/full`);
  const a = json.data;
  return {
    ...normalizeAnime(a),
    japanese_title: a.title_japanese || "",
    type: a.type || "",
    episodes: a.episodes || null,
    status: a.status || "",
    duration: a.duration || "",
    genres: (a.genres || []).map((g) => g.name),
    studios: (a.studios || []).map((s) => s.name),
    relations: a.relations || [],
  };
}

// 100 episodes per page (page 1 = episodes 1-100, page 2 = 101-200, ...)
export async function animeEpisodes(id, page = 1) {
  const json = await jikan(`anime/${encodeURIComponent(id)}/episodes`, { page });
  return {
    episodes: (json.data || []).map((e) => ({
      number: e.mal_id, // in Jikan's episode list, mal_id is the episode number
      title: e.title || "",
      aired: e.aired || "",
      filler: !!e.filler,
      recap: !!e.recap,
    })),
    lastPage: json.pagination?.last_visible_page || 1,
  };
}

export async function animeRecommendations(id) {
  const json = await jikan(`anime/${encodeURIComponent(id)}/recommendations`);
  return (json.data || [])
    .filter((r) => r.entry?.mal_id)
    .slice(0, 20)
    .map((r) => normalizeAnime(r.entry));
}