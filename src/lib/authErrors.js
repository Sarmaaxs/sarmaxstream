// Turns Supabase / network errors into something a person can act on.
export function friendlyAuthError(err, fallback = "Something went wrong. Please try again.") {
  const m = String((err && err.message) || err || "");
  if (/invalid login credentials/i.test(m)) return "Wrong email or password. If you created your account with Google, use “Continue with Google”.";
  if (/email not confirmed/i.test(m)) return "Your email isn't confirmed yet. Check your inbox (and spam) for the confirmation message.";
  if (/rate limit|too many|over_email_send_rate_limit|security purposes/i.test(m)) return "Too many attempts. Wait a minute and try again.";
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(m)) return "Can't reach the sign-in server. Check your connection and try again.";
  if (/api key|apikey|invalid url|missing\.supabase/i.test(m)) return "Sign-in isn't set up on this site yet (missing Supabase settings).";
  if (/already registered|already exists/i.test(m)) return "An account with this email already exists. Try signing in instead.";
  if (/password should be|weak password/i.test(m)) return m;
  return m || fallback;
}
