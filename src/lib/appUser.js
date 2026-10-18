// Maps a Supabase auth user to the shape the UI already expects.
export function toAppUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    full_name: u.user_metadata?.full_name || u.user_metadata?.name || "",
    created_date: u.created_at,
    is_verified: !!u.email_confirmed_at,
    role: "user",
  };
}
