// Vercel serverless proxy for Jikan.
// Put this file at:  sarmaxstreams/api/jikan.js   (same level as package.json)
//
// Why: Vercel's CDN caches the response, so Jikan is only hit once every few
// minutes instead of on every visitor's page load. If Jikan is slow/down,
// visitors still get the cached copy.

const ALLOWED = /^(top\/anime|anime|anime\/\d+\/(full|episodes|recommendations))$/;

export default async function handler(req, res) {
  const { path, ...rest } = req.query;
  const p = Array.isArray(path) ? path[0] : path;

  // Only allow the endpoints the app actually uses (not an open proxy).
  if (!p || !ALLOWED.test(p)) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({ error: "Bad path" });
  }

  const qs = new URLSearchParams();
  Object.entries(rest).forEach(([k, v]) => qs.set(k, Array.isArray(v) ? v[0] : v));
  const url = `https://api.jikan.moe/v4/${p}${qs.toString() ? `?${qs}` : ""}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000); // fail fast so the client can retry

  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    const body = await r.text();

    res.setHeader("Content-Type", "application/json");

    if (!r.ok) {
      res.setHeader("Cache-Control", "no-store"); // never cache errors
      return res.status(r.status).send(body);
    }

    // Fresh for 10 min, then serve stale for up to 24h while refreshing in background.
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
    return res.status(200).send(body);
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(504).json({ error: "Upstream timeout" });
  } finally {
    clearTimeout(timer);
  }
}