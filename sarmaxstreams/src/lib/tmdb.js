
const IMG_BASE = "https://image.tmdb.org/t/p";

export function imageUrl(path, size = "w500") {
  if (!path) return null;
  return `${IMG_BASE}/${size}${path}`;
}

export function backdropUrl(path, size = "original") {
  if (!path) return null;
  return `${IMG_BASE}/${size}${path}`;
}

// Proxy a TMDB v3 endpoint through the Railway API (keeps the token server-side).
// path: e.g. "trending/movie/week", "movie/550", "search/multi", "genre/movie/list"
const API = import.meta.env.VITE_API_URL;
export async function tmdb(path, params = {}) {
  const res = await fetch(`${API}/tmdb`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, params }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Request failed");
  return (await res.json()).data;
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
