import { supabase } from "@/api/supabaseClient";

export async function currentUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export function normalizeMedia(item) {
  const mediaType = item.media_type || (item.first_air_date ? "tv" : "movie");
  return {
    tmdb_id: String(item.tmdb_id || item.id),
    media_type: mediaType,
    title: item.title || item.name || "Untitled",
    poster_path: item.poster_path || "",
    backdrop_path: item.backdrop_path || "",
    overview: item.overview || "",
    release_year: (item.release_date || item.first_air_date || "").slice(0, 4),
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
  };
}

export async function getWatchlist() {
  const me = await currentUser();
  if (!me) return [];
  const { data, error } = await supabase
    .from("watchlist_items").select("*").order("updated_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data;
}

export async function findWatchlistItem(tmdb_id, media_type) {
  const me = await currentUser();
  if (!me) return null;
  const { data, error } = await supabase
    .from("watchlist_items").select("*")
    .eq("tmdb_id", String(tmdb_id)).eq("media_type", media_type).maybeSingle();
  if (error) throw error;
  return data;
}

export async function toggleWatchlist(item) {
  const me = await currentUser();
  if (!me) throw new Error("Sign in to save titles");
  const media = normalizeMedia(item);
  const existing = await findWatchlistItem(media.tmdb_id, media.media_type);
  if (existing) {
    const { error } = await supabase.from("watchlist_items").delete().eq("id", existing.id);
    if (error) throw error;
    return { saved: false };
  }
  const { error } = await supabase.from("watchlist_items").insert({ ...media, user_id: me.id });
  if (error) throw error;
  return { saved: true };
}

export async function getContinueWatching() {
  const me = await currentUser();
  if (!me) return [];
  const { data, error } = await supabase
    .from("continue_watching").select("*").order("updated_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

export async function recordContinueWatching(item, extra = {}) {
  const me = await currentUser();
  if (!me) return;
  const media = normalizeMedia(item);
  const { error } = await supabase.from("continue_watching").upsert(
    {
      user_id: me.id,
      tmdb_id: media.tmdb_id,
      media_type: media.media_type,
      title: media.title,
      poster_path: media.poster_path,
      backdrop_path: media.backdrop_path,
      season: extra.season ?? null,
      episode: extra.episode ?? null,
      position: extra.position ?? 0,
      duration: extra.duration ?? 0,
    },
    { onConflict: "user_id,tmdb_id,media_type" }
  );
  if (error) throw error;
}

export async function removeContinueWatching(id) {
  const { error } = await supabase.from("continue_watching").delete().eq("id", id);
  if (error) throw error;
}
