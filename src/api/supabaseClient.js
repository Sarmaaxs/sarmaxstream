import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// false when the Vercel environment variables are missing (the usual reason sign-in "does nothing")
export const authConfigured = !!(url && key);
if (!authConfigured) {
  console.error("[auth] VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are missing. Add them in Vercel > Settings > Environment Variables, then redeploy.");
}

// Placeholders keep the app from crashing on start when the variables are missing.
export const supabase = createClient(url || "https://missing.supabase.co", key || "missing-key", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
