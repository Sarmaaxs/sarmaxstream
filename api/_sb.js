// Shared Supabase REST helper, server only.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel (never VITE_).
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const sbReady = () => !!(SB_URL && SB_KEY);

// path is relative to /rest/v1/, e.g. 'music_events?user_key=eq.abc'.
// Returns parsed JSON, true for empty success, or null on any failure.
export async function sb(path, { method = 'GET', body, prefer } = {}) {
  if (!sbReady()) return null;
  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : true;
  } catch {
    return null;
  }
}
