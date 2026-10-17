import { cachedJson } from "@/lib/cache";
const IMG_BASE = "https://image.tmdb.org/t/p";

// Anime posters come from MyAnimeList as full URLs (https://...), so pass
// those through untouched. TMDB paths (/abc.jpg) get the TMDB base added.
const isAbsolute = (p) => /^https?:\/\//i.test(p);

export function imageUrl(path, size = "w500") {
  if (!path) return null;
  if (isAbsolute(path)) return path;
  return `${IMG_BASE}/${size}${path}`;
}

export function backdropUrl(path, size = "w1280") {
  if (!path) return null;
  if (isAbsolute(path)) return path;
  return `${IMG_BASE}/${size}${path}`;
}

export { isAbsolute };

// Proxy a TMDB v3 endpoint through your API (keeps the token server-side).
// path: e.g. "trending/movie/week", "movie/550", "search/multi", "genre/movie/list"
//
// SPEED: we ask with GET first. A GET can be cached at the edge (Vercel's CDN,
// your API already sends s-maxage) and needs no extra CORS "preflight" round trip.
// A POST can't be cached and costs one extra network trip every time.
// If the server only understands POST, we fall back to it automatically.
const API = import.meta.env.VITE_API_URL;
const TTL = 15 * 60 * 1000;

function toQuery(path, params) {
  const q = new URLSearchParams({ path });
  Object.keys(params || {}).sort().forEach((k) => {
    if (params[k] !== undefined && params[k] !== null) q.set(k, String(params[k]));
  });
  return q.toString();
}

export async function tmdb(path, params = {}) {
  let res;
  try {
    res = await cachedJson(`${API}/tmdb?${toQuery(path, params)}`, { method: "GET" }, TTL);
  } catch {
    res = null;
  }
  if (!res || res.error) {
    const body = JSON.stringify({ path, params });
    res = await cachedJson(`${API}/tmdb`, { method: "POST", headers: { "Content-Type": "application/json" }, body }, TTL);
  }
  if (!res || res.error) throw new Error((res && res.error) || "Request failed");
  return res.data !== undefined ? res.data : res;
}

export async function tmdbTrending(window = "week") {
  return tmdb(`trending/all/${window}`);
}

export async function tmdbPopular(type = "movie", page = 1) {
  return tmdb(`${type}/popular`, { page });
}

export async function tmdbTopRated(type = "movie", page = 1) {
  return tmdb(`${type}/top_rated`, { page });
}

export async function tmdbByGenre(type, genreId, page = 1) {
  return tmdb(`discover/${type}`, { with_genres: genreId, sort_by: "popularity.desc", page });
}

export async function tmdbGenres(type = "movie") {
  return tmdb(`genre/${type}/list`);
}

export async function tmdbSearch(query, page = 1) {
  return tmdb("search/multi", { query, page, include_adult: false });
}

export async function tmdbDetails(type, id) {
  return tmdb(`${type}/${id}`, { append_to_response: "videos,similar,credits" });
}

export async function tmdbSeason(tvId, seasonNumber) {
  return tmdb(`tv/${tvId}/season/${seasonNumber}`);
}
