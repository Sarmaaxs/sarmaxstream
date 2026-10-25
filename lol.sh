#!/usr/bin/env bash
# sarmax-patches.sh — run from the ROOT of the sarmaxstream repo (where package.json is).
#
#   bash sarmax-patches.sh
#   KEEP_MASCOT=1 bash sarmax-patches.sh     # keep the dog on the music pages
#
# Safe to run twice. Every edit is anchored to exact text; if an anchor is missing
# (your repo moved on since the zip), that one edit is skipped and listed at the end.
# Nothing here touches the movie players' server list or the music playback code.
set -u

[ -f package.json ] && [ -d api ] && [ -d src ] || { echo "Run this from the repo root."; exit 1; }

# ---- 1. delete the disconnected PHP admin (password 1234 is public in git history) ----
if [ -d admin ]; then
  if [ -d .git ]; then git rm -rq admin 2>/dev/null || rm -rf admin; else rm -rf admin; fi
  echo "removed admin/"
fi

mkdir -p .github/workflows supabase

# ---- 2. CI that actually builds (a broken build already shipped once) ----
cat > .github/workflows/ci.yml <<'YML'
name: CI
on:
  push:
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: Syntax-check the serverless functions
        run: for f in api/*.js; do node --check "$f" || exit 1; done
YML
echo "wrote .github/workflows/ci.yml"

# ---- 3. Supabase: lock down the tables that were never in the repo ----
cat > supabase/security.sql <<'SQL'
-- Run once in Supabase -> SQL Editor. Safe to run again.

-- 1) Row-level security for the two tables the repo never defined.
alter table if exists public.watchlist_items   enable row level security;
alter table if exists public.continue_watching enable row level security;

drop policy if exists "watchlist_items_own" on public.watchlist_items;
create policy "watchlist_items_own" on public.watchlist_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "continue_watching_own" on public.continue_watching;
create policy "continue_watching_own" on public.continue_watching
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 2) delete_my_account(): only signed-in users may call it, and it gets a fixed search_path.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_my_account'
  ) then
    revoke all on function public.delete_my_account() from public, anon;
    grant execute on function public.delete_my_account() to authenticated;
    alter function public.delete_my_account() set search_path = public, pg_temp;
  end if;
end $$;

-- 3) READ THESE RESULTS. Policies are OR-ed together: one old "using (true)" policy
--    on a table cancels every good policy on it. Delete anything loose you see.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;

-- delete_my_account should show prosecdef = true and proconfig containing search_path.
select proname, prosecdef, proconfig from pg_proc
where proname = 'delete_my_account' and pronamespace = 'public'::regnamespace;
SQL
echo "wrote supabase/security.sql  (run it in the Supabase SQL editor)"

# ---- 4. the bridge wrapper (new file) ----
cat > src/lib/nativeBridge.js <<'JS'
// Android app only. The native side exposes its bridge as `SxRaw` and every call needs a
// per-launch token that only our own pages receive. This wrapper re-creates the old
// `window.SxNative` API for our code, so video iframes (which also see `SxRaw`) cannot use it.
(function installNativeBridge() {
  if (typeof window === 'undefined') return;
  const raw = window.SxRaw;
  if (!raw) return; // website, or an old app build that still exposes SxNative directly
  const names = ['keepScreenOn', 'setMedia', 'setPlaying', 'beginFile', 'appendFile', 'endFile', 'setAppLock', 'isAppLockEnabled', 'share'];
  const api = {};
  names.forEach((n) => {
    api[n] = (...args) => raw[n](window.__sxTok, ...args);
  });
  window.SxNative = api;
  try { delete window.SxRaw; } catch { /* some WebViews make it read-only: harmless */ }
})();
JS
echo "wrote src/lib/nativeBridge.js"

python3 - <<'PY'
import os, re, sys, json

FAILED = []

def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()

def write(p, t):
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(t)

def edit(path, old, new, marker=None, label=None, every=False):
    label = label or f"{path}: {old[:40]!r}"
    if not os.path.exists(path):
        FAILED.append(f"{label} (file missing)"); return
    t = read(path)
    if marker and marker in t:
        print("  skip (already applied):", label); return
    if old not in t:
        if new == "":
            print("  skip (already removed):", label)
        else:
            FAILED.append(label)
        return
    t = t.replace(old, new) if every else t.replace(old, new, 1)
    write(path, t)
    print("  ok:", label)

# ============================================================ A. Android bridge + navigation
J = "mobile/MainActivity.java"
print("[A] Android: token-guarded bridge, scheme blocking")

edit(J, "  private static final long RESTORE_MAX_AGE",
r'''  // Per-launch secret for the JS bridge. Only our own pages receive it (see onPageFinished),
  // so a third-party video iframe that finds the raw bridge still cannot call anything on it.
  private static final String BRIDGE_TOKEN = newBridgeToken();

  private static String newBridgeToken() {
    byte[] b = new byte[16];
    new java.security.SecureRandom().nextBytes(b);
    StringBuilder sb = new StringBuilder();
    for (byte x : b) sb.append(String.format("%02x", x));
    return sb.toString();
  }

  private static boolean tokOk(String t) {
    return t != null && java.security.MessageDigest.isEqual(BRIDGE_TOKEN.getBytes(), t.getBytes());
  }

  // Ad scripts love intent: / market: links that jump out to Play Store or another app.
  private static boolean isBlockedScheme(String s) {
    if (s == null) return false;
    s = s.toLowerCase(java.util.Locale.ROOT);
    return "intent".equals(s) || "market".equals(s) || "android-app".equals(s);
  }

  // The only outside links we open on purpose (a real tap on the Telegram support link).
  private static boolean isOpenExternally(String host) {
    return "t.me".equals(host) || "telegram.me".equals(host);
  }

  private void openExternal(Uri u) {
    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
  }

  private static final long RESTORE_MAX_AGE''', marker="BRIDGE_TOKEN = newBridgeToken", label="java: token helpers")

if os.path.exists(J):
    t = read(J)
    if "tokOk(tok)" in t:
        print("  skip (already applied): java: guard native methods")
    else:
        defaults = {"void": "return;", "int": "return -1;", "boolean": "return false;", "String": 'return "";'}
        pat = re.compile(r'(@JavascriptInterface\s+public (?:synchronized )?(void|int|boolean|String) \w+\()([^)]*)(\)\s*\{)')
        count = 0
        def sub(m):
            global count
            count += 1
            params = m.group(3).strip()
            newparams = "String tok" + (", " + params if params else "")
            return m.group(1) + newparams + m.group(4) + "\n      if (!tokOk(tok)) " + defaults[m.group(2)]
        t2 = pat.sub(sub, t)
        if count != 9:
            FAILED.append(f"java: expected 9 @JavascriptInterface methods, found {count} (not written)")
        else:
            write(J, t2); print("  ok: java: guarded", count, "native methods")

edit(J, '          setMedia(true, title, artist, "", 0, 0);', '          setMedia(tok, true, title, artist, "", 0, 0);',
        marker="setMedia(tok, true,", label="java: internal setMedia call uses the new signature")

edit(J, 'webView.addJavascriptInterface(new SxNative(), "SxNative");',
        'webView.addJavascriptInterface(new SxNative(), "SxRaw"); // wrapped by src/lib/nativeBridge.js',
        marker='"SxRaw"', label="java: rename raw bridge")

edit(J, '''      public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
''', '''      public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        // hand the bridge token to OUR pages only (evaluateJavascript runs in the main frame, never in iframes)
        if (url != null && isOwnUrl(url)) view.evaluateJavascript("window.__sxTok='" + BRIDGE_TOKEN + "';", null);
''', marker="window.__sxTok=", label="java: inject token")

edit(J, '''        if (isHttp && request.isForMainFrame() && !isOwnHost(u.getHost())) {
          return true; // swallow: do nothing (no Chrome, no new tab)
        }''', '''        if (request.isForMainFrame() && isBlockedScheme(scheme)) return true;
        if (isHttp && request.isForMainFrame() && !isOwnHost(u.getHost())) {
          if (Build.VERSION.SDK_INT >= 24 && request.hasGesture() && isOpenExternally(u.getHost())) openExternal(u);
          return true; // swallow: do nothing (no Chrome, no new tab)
        }''', marker="isBlockedScheme(scheme)) return true;\n        if (isHttp && request", label="java: block intent:/market: (new API)")

edit(J, '''        if (isHttp && !isOwnHost(u.getHost())) return true;
        return super.shouldOverrideUrlLoading(view, url);''', '''        if (isBlockedScheme(scheme)) return true;
        if (isHttp && !isOwnHost(u.getHost())) return true;
        return super.shouldOverrideUrlLoading(view, url);''', marker="if (isBlockedScheme(scheme)) return true;\n        if (isHttp && !isOwnHost", label="java: block intent:/market: (old API)")

edit("src/main.jsx", "import React from 'react'\n",
     "import '@/lib/nativeBridge' // must run before anything reads window.SxNative\nimport React from 'react'\n",
     marker="nativeBridge", label="main.jsx: load bridge wrapper first")

# ============================================================ B. API fixes
print("[B] API: youtube host allowlist, https-only tunnel, debug gate")
D = "api/downloadMusic.js"
edit(D, "function buildYoutubeUrl(idOrUrl) {",
        "const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);\n\nfunction buildYoutubeUrl(idOrUrl) {",
        marker="const YT_HOSTS", label="download: allowlist const")
edit(D, "    if (u.hostname.includes('youtu')) return s;",
        "    if (u.protocol === 'https:' && YT_HOSTS.has(u.hostname.toLowerCase())) return u.toString();",
        marker="YT_HOSTS.has", label="download: exact host match")
edit(D, "  const { fileUrl, filename } = pickFile(c.data);\n  if (!fileUrl) return",
        "  const { fileUrl, filename } = pickFile(c.data);\n  if (fileUrl) {\n    let okUrl = false;\n    try { okUrl = new URL(fileUrl).protocol === 'https:'; } catch { /* bad url */ }\n    if (!okUrl) return { ok: false, error: 'cobalt returned a non-https file url' };\n  }\n  if (!fileUrl) return",
        marker="non-https file url", label="download: https-only tunnel")
edit(D, "String(t.filename).replace(/\"/g, '')", "String(t.filename).replace(/[\"\\r\\n]/g, '')",
        marker="[\"\\r\\n]", label="download: header-safe filename")

edit("api/searchMusic.js", "res.status(200).json(body.debug ? { ...payload, diag } : payload);",
     "res.status(200).json(body.debug && process.env.ALLOW_DEBUG === '1' ? { ...payload, diag } : payload);",
     marker="ALLOW_DEBUG", label="searchMusic: debug only when ALLOW_DEBUG=1")

# ============================================================ C. vercel.json
print("[C] vercel.json: scope CDN caching, CSP report-only")
VJ = "vercel.json"
if os.path.exists(VJ):
    v = json.loads(read(VJ))
    changed = False
    for h in v.get("headers", []):
        if h.get("source") == "/api/(.*)":
            h["source"] = "/api/((?!stream|downloadMusic|health).*)"; changed = True
        if h.get("source") == "/(.*)" and not any(x["key"] == "Content-Security-Policy-Report-Only" for x in h["headers"]):
            embeds = "https://vidlink.pro https://vidsrc.to https://vidsrc.xyz https://megaplay.buzz https://vidhawk.buzz"
            csp = ("default-src 'self'; "
                   "script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com https://va.vercel-scripts.com; "
                   "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                   "font-src 'self' https://fonts.gstatic.com data:; "
                   "img-src 'self' data: blob: https:; media-src 'self' blob: https:; "
                   f"connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://graphql.anilist.co https://vitals.vercel-insights.com {embeds}; "
                   f"frame-src https://www.youtube.com https://www.youtube-nocookie.com {embeds}; "
                   "worker-src 'self'; manifest-src 'self'")
            h["headers"].append({"key": "Content-Security-Policy-Report-Only", "value": csp}); changed = True
    if changed:
        write(VJ, json.dumps(v, indent=2) + "\n"); print("  ok: vercel.json")
    else:
        print("  skip (already applied): vercel.json")

# ============================================================ D. service worker
print("[D] service worker")
S = "public/sw.js"
edit(S, "const V = 'v1';", "const V = 'v2';", marker="const V = 'v2'", label="sw: bump cache version")
edit(S, "const MAX_IMAGES = 400;", "const MAX_IMAGES = 60; // opaque images count ~7 MB of quota each", marker="MAX_IMAGES = 60", label="sw: fewer opaque images")
edit(S, "searchBooks|jikan|health)", "searchBooks|jikan)", marker="searchBooks|jikan)", label="sw: don't cache /api/health")

# ============================================================ E. players
print("[E] players: honest sandbox flags, app runs without sandbox")
A = "src/components/AnimePlayer.jsx"
edit(A, ' allow-popups allow-popups-to-escape-sandbox";', ' allow-popups";', marker='allow-presentation allow-popups";', label="anime: pop-ups stay sandboxed")
edit(A, "function readSafe() {\n  try {", 'const SHIELDED = typeof navigator !== "undefined" && /SxShield/.test(navigator.userAgent);\n\nfunction readSafe() {\n  if (SHIELDED) return false; // the Android app swallows pop-ups itself, so embeds get no sandbox\n  try {',
     marker="if (SHIELDED) return false", label="anime: no sandbox inside the app")
edit(A, "          onClick={toggleSafe}\n          aria-pressed={safe}", "          onClick={toggleSafe}\n          hidden={SHIELDED}\n          aria-pressed={safe}", marker="hidden={SHIELDED}", label="anime: hide toggle inside the app")

# ============================================================ F. site polish
print("[F] index.html, sitemap, spinner")
H = "index.html"
edit(H, 'type="image/svg+xml" href="/favicon.png"', 'type="image/png" href="/favicon.png"', marker='type="image/png" href="/favicon.png"', label="html: favicon type")
edit(H, "family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap",
        "family=Archivo:wght@600;700;800&family=Public+Sans:wght@400;500;600;700&display=swap",
        marker="family=Archivo", label="html: fonts", every=True)
edit(H, '    <title>Sarmaxstream</title>',
'''    <title>Sarmaxstream</title>
    <link rel="canonical" href="https://sarmaxstreams.vercel.app/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Sarmaxstream" />
    <meta property="og:title" content="Sarmaxstream" />
    <meta property="og:description" content="Music with lyrics, movies, TV, anime and books." />
    <meta property="og:image" content="https://sarmaxstreams.vercel.app/icon-512.png" />
    <meta name="twitter:card" content="summary" />''', marker='rel="canonical"', label="html: canonical + social tags")

write("public/sitemap.xml", '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://sarmaxstreams.vercel.app/</loc><lastmod>2026-10-25</lastmod><priority>1.0</priority></url>
  <url><loc>https://sarmaxstreams.vercel.app/music</loc><lastmod>2026-10-25</lastmod><priority>0.8</priority></url>
  <url><loc>https://sarmaxstreams.vercel.app/anime</loc><lastmod>2026-10-25</lastmod><priority>0.8</priority></url>
  <url><loc>https://sarmaxstreams.vercel.app/books</loc><lastmod>2026-10-25</lastmod><priority>0.7</priority></url>
  <url><loc>https://sarmaxstreams.vercel.app/search</loc><lastmod>2026-10-25</lastmod><priority>0.5</priority></url>
</urlset>
''')
print("  ok: public/sitemap.xml (removed /movies and /tv-shows, which are not routes)")

for f in ("src/App.jsx", "src/components/ProtectedRoute.jsx"):
    edit(f, "border-slate-200 border-t-slate-800", "border-border border-t-primary", marker="border-border border-t-primary", label=f"{f}: visible spinner on dark theme", every=True)

# ============================================================ G. de-slop the design
print("[G] design: fonts, purple accent, orbs, mascot, pasted CSS, leftover comments")
C = "src/index.css"
edit(C, "--font-heading: 'Space Grotesk',", "--font-heading: 'Archivo',", marker="--font-heading: 'Archivo'", label="css: heading font")
edit(C, "--font-display: 'Space Grotesk',", "--font-display: 'Archivo',", marker="--font-display: 'Archivo'", label="css: display font")
edit(C, "--font-body: 'Inter',", "--font-body: 'Public Sans',", marker="--font-body: 'Public Sans'", label="css: body font")
edit(C, "--accent: 270 100% 50%;", "--accent: 240 5% 16%;", marker="--accent: 240 5% 16%;", label="css: neutral accent (was electric violet in dropdowns/ghost hovers)", every=True)
edit(C, "--chart-2: 270 100% 50%;", "--chart-2: 43 74% 66%;", marker="--chart-2: 43 74% 66%;", label="css: chart colour", every=True)

if os.path.exists(C):
    t = read(C)
    a = t.find("/* ====== Sarmaxstream upgrade: moving colour glow, equalizer ====== */")
    b = t.find("/* ====== Sarmaxstream upgrade v2 (aurora + fixed download) ====== */")
    if a != -1 and b > a:
        t = t[:a] + t[b:]
        print("  ok: css: removed the pasted duplicate block (v2 below it redefines every rule)")
    t = t.replace("/* ====== Nuvessia upgrade: karaoke lyrics, moving colour glow, equalizer ====== */", "/* ====== Karaoke lyrics, now-playing glow, equalizer ====== */")
    t = t.replace("/* ====== Sarmaxstream upgrade v2 (aurora + fixed download) ====== */", "/* ====== Now-playing glow (album-colour aurora) ====== */")
    t = t.replace("/* ===== Offline downloads + richer lyrics aurora ===== */", "/* ===== Extra aurora layers ===== */")
    write(C, t)

M = "src/components/MusicLayout.jsx"
keep = os.environ.get("KEEP_MASCOT") == "1"
edit(M, "import AnimatedBackground from '@/components/AnimatedBackground';\n", "", label="layout: drop orb import")
edit(M, "      <AnimatedBackground playing={player && player.isPlaying} />\n", "", label="layout: drop drifting orbs (also fixes its global .eq CSS leaking onto the equalizer)")
if not keep:
    edit(M, "import DogMascot from '@/components/DogMascot';\n", "", label="layout: drop mascot import")
    edit(M, "      <DogMascot />\n", "", label="layout: drop mascot (hotlinked a base44 image)")
    if os.path.exists("src/components/DogMascot.jsx"): os.remove("src/components/DogMascot.jsx")
else:
    print("  kept DogMascot (KEEP_MASCOT=1)")
if os.path.exists("src/components/AnimatedBackground.jsx"): os.remove("src/components/AnimatedBackground.jsx")

# leftover comments from the platform migration / LLM paste jobs
for f in ["src/components/SearchBar.jsx", "src/components/PosterMarquee.jsx", "src/pages/MusicHome.jsx", "src/pages/Artist.jsx"]:
    if os.path.exists(f):
        t = read(f); t2 = re.sub(r"^[ \t]*// base44 removed[^\n]*\n", "", t, flags=re.M)
        if t2 != t: write(f, t2); print("  ok:", f, "(stale comment)")

edit("api/getLyrics.js", "// api/getLyrics.js — REPLACES base44/functions/getLyrics/entry.ts\n// Deploy target: same as searchMusic.js (Vercel serverless / Railway+Express).\n",
     "// api/getLyrics.js — lyrics lookup.\n", marker="// api/getLyrics.js — lyrics lookup.", label="getLyrics: header comment")
edit("api/searchMusic.js", "// api/searchMusic.js — REPLACES base44/functions/searchMusic/entry.ts\n// Deploy target: Vercel serverless function (drop straight in /api on Vercel)\n// or Railway/Express (wrap the handler in an app.post route — same body).\n",
     "// api/searchMusic.js — song, artist and chart search.\n", marker="// api/searchMusic.js — song, artist and chart search.", label="searchMusic: header comment")
edit("api/searchMusic.js", "// Call it the same way you called base44.functions.invoke('searchMusic', body):\n", "// Call it with:\n", marker="// Call it with:\n", label="searchMusic: usage comment")
edit("api/searchMusic.js", "// NEW vs. the Base44 version:\n//   - Shorts filter fix (see searchMusic-shorts-fix.md for the isolated diff)\n", "// Notes:\n//   - Shorts are filtered out\n", marker="//   - Shorts are filtered out", label="searchMusic: changelog comment")
edit("src/lib/useMusicLibrary.jsx", """// NOTE on AuthContext: your Base44 AuthContext.jsx exposed
// `base44.auth.redirectToLogin(...)`. Reuse Sarmaxstream's AuthContext.jsx
// as-is (it's already Supabase-based) — it exposes `user` and a login
// redirect helper, which is exactly what this file expects. Don't write a
// third auth system; one Supabase auth context for both apps.
""", "", label="useMusicLibrary: migration note")
edit("src/pages/PlaylistView.jsx", "needed here —\n  // this replaces the old base44.entities.Playlist.get(id) round trip.", "needed here.", marker="fetch-by-id call is needed here.\n", label="PlaylistView: migration note")

# ============================================================ H. release workflow
print("[H] APK workflow")
edit(".github/workflows/build-apk.yml", "          files: mobile/sarmaxstream.apk\n",
     "          files: mobile/sarmaxstream.apk\n          prerelease: ${{ env.KEYSTORE_BASE64 == '' }}\n",
     marker="prerelease:", label="apk: mark debug-signed builds as pre-release")

print()
if FAILED:
    print("SKIPPED (anchor not found, left untouched):")
    for f in FAILED: print("  -", f)
    sys.exit(2)
print("All patches applied.")
PY
rc=$?

echo
echo "Next:"
echo "  1. npm ci && npm run build      # must pass before you push"
echo "  2. git diff --stat               # read what changed"
echo "  3. Run supabase/security.sql in the Supabase SQL editor and read the last two result tables"
echo "  4. Vercel env: do NOT set ALLOW_DEBUG in production"
echo "  5. Push, then rebuild the APK (the Java changes need a new build; old APKs keep working)"
exit $rc
