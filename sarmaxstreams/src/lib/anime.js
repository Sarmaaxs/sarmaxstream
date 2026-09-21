// ---------------------------------------------------------------------------
// Anime helpers
//  - Metadata (posters, titles, episode lists) comes from Jikan, a free
//    MyAnimeList API. No API key needed.
//  - Playback comes from YOUR source:
//      https://myfriend.link/anime/{MALid}/{number}/{subOrDub}
// ---------------------------------------------------------------------------

// >>> Change these two lines if your source changes <<<
export const ANIME_STREAM_BASE = "https://vidlink.pro/anime";
export const AUDIO_OPTIONS = ["sub", "dub"]; // exact values your source expects

export function animeStreamUrl(malId, episode = 1, audio = "sub") {
  const a = AUDIO_OPTIONS.includes(audio) ? audio : AUDIO_OPTIONS[0];
  return `${ANIME_STREAM_BASE}/${encodeURIComponent(malId)}/${encodeURIComponent(episode)}/${a}`;
}

// ------------------------- Jikan (metadata) --------------------------------

const JIKAN = "https://api.jikan.moe/v4";
const cache = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jikan(path, params = {}, retries = 2) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  const url = `${JIKAN}/${path}${qs.toString() ? `?${qs}` : ""}`;
  if (cache.has(url)) return cache.get(url);

  const res = await fetch(url);
  // Jikan allows ~3 requests/second. Wait a moment and try again.
  if ((res.status === 429 || res.status >= 500) && retries > 0) {
    await sleep(1200);
    return jikan(path, params, retries - 1);
  }
  if (!res.ok) throw new Error("Anime service is busy. Please try again.");
  const json = await res.json();
  cache.set(url, json);
  return json;
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

function toList(json) {
  const seen = new Set();
  const items = [];
  for (const a of json.data || []) {
    if (!a?.mal_id || seen.has(a.mal_id)) continue;
    seen.add(a.mal_id);
    items.push(normalizeAnime(a));
  }
  return { items, hasNext: !!json.pagination?.has_next_page };
}

function kindParams(kind) {
  switch (kind) {
    case "popular":
      return { filter: "bypopularity" };
    case "top":
      return {};
    case "movies":
      return { type: "movie" };
    case "airing":
    default:
      return { filter: "airing" };
  }
}

// kind: "airing" | "popular" | "top" | "movies"
export async function animeList(kind = "airing", page = 1) {
  const json = await jikan("top/anime", { ...kindParams(kind), page, limit: 24, sfw: true });
  return toList(json);
}

export async function animeSearch(query, page = 1) {
  const json = await jikan("anime", { q: query, page, limit: 24, sfw: true });
  return toList(json);
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