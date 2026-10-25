#!/usr/bin/env bash
# sarmax-free-music.sh — run from the repo root (after, or without, sarmax-patches.sh).
#
#   bash sarmax-free-music.sh
#
# Adds two openly-licensed music sources next to Audius and Jamendo:
#   Internet Archive  (ia_<identifier>)  Creative Commons / public-domain audio
#   Openverse         (ov_<uuid>)        CC music from Wikimedia Commons, Jamendo, Freesound ...
# and a "Free to download" section on the music search page, with the licence shown on each track.
#
# Because the site shows ads, NonCommercial (NC) licences are excluded from both new sources,
# and the licence is re-checked when the audio is streamed or downloaded (not only when searching).
#
# Optional env (Vercel): OPENVERSE_CLIENT_ID + OPENVERSE_CLIENT_SECRET (free; raises Openverse's rate limit).
set -u
[ -f package.json ] && [ -d api ] && [ -d src ] || { echo "Run this from the repo root."; exit 1; }

python3 - <<'PY'
import os, sys

FAILED = []

def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()

def write(p, t):
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(t)

def edit(path, old, new, marker=None, label=None):
    label = label or f"{path}: {old[:40]!r}"
    if not os.path.exists(path):
        FAILED.append(f"{label} (file missing)"); return
    t = read(path)
    if marker and marker in t:
        print("  skip (already applied):", label); return
    if old not in t:
        FAILED.append(label); return
    write(path, t.replace(old, new, 1))
    print("  ok:", label)

# ===================================================================== api/_free.js
F = "api/_free.js"
print("[1] api/_free.js: Internet Archive + Openverse")

edit(F, "async function getJson(url, ms = 6000) {", "async function getJson(url, ms = 6000, extraHeaders) {",
     marker="extraHeaders) {", label="free: getJson accepts headers")
edit(F, "const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } });",
        "const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json', 'User-Agent': 'sarmaxstream/1.0', ...(extraHeaders || {}) } });",
     marker="'User-Agent': 'sarmaxstream/1.0', ...(extraHeaders", label="free: send a User-Agent")

edit(F, "      source: 'jamendo',\n      verified: false,\n    }));",
        "      source: 'jamendo',\n      license: ccLabel(t.license_ccurl),\n      verified: false,\n    }));",
     marker="license: ccLabel(t.license_ccurl)", label="free: label Jamendo licences")

edit(F, "// Anything else is a YouTube video id.",
        "//   ia_<identifier>  ->  /api/stream?id=ia_...   (Internet Archive, Creative Commons / public domain)\n//   ov_<uuid>        ->  /api/stream?id=ov_...   (Openverse, Creative Commons)\n// Anything else is a YouTube video id.",
     marker="ia_<identifier>  ->", label="free: header comment")

NEW_SECTION = r'''// ---------------------------------------------------------------------------
// Internet Archive + Openverse: openly licensed music.
// The site shows ads, so NonCommercial (NC) licences are excluded from both sources.
// Optional env: OPENVERSE_CLIENT_ID + OPENVERSE_CLIENT_SECRET (free) raise Openverse's rate limit.
// ---------------------------------------------------------------------------
const IA_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const OV_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CC_URL = /^https?:\/\/(?:www\.)?creativecommons\.org\//i;
const isNC = (s) => /(^|[/_\s-])nc([/_\s-]|$)/i.test(String(s || ''));
const first = (v) => (Array.isArray(v) ? v[0] : v);

// "http://creativecommons.org/licenses/by-sa/4.0/" -> "CC BY-SA 4.0";  Openverse code "by", "4.0" -> "CC BY 4.0"
function ccLabel(urlOrCode, version) {
  const s = String(urlOrCode || '');
  if (!s) return '';
  const m = /\/licenses\/([a-z-]+)\/([\d.]+)/i.exec(s);
  if (m) return `CC ${m[1].toUpperCase()} ${m[2]}`;
  if (/publicdomain\/zero|\bcc0\b|\/zero\//i.test(s)) return 'CC0';
  if (/publicdomain|\bpdm\b/i.test(s)) return 'Public domain';
  if (/^[a-z-]{2,12}$/i.test(s)) return `CC ${s.toUpperCase()}${version ? ' ' + version : ''}`;
  return 'Creative Commons';
}

export async function searchArchive(query, limit) {
  const words = qWords(query).filter((w) => !STOP.has(w) && !['or', 'not', 'to'].includes(w)).slice(0, 6);
  if (!words.length) return { items: [], why: 'empty query' };
  const q = `(${words.join(' AND ')}) AND mediatype:audio AND licenseurl:http*creativecommons.org*`;
  const u = new URL('https://archive.org/advancedsearch.php');
  u.searchParams.set('q', q);
  for (const f of ['identifier', 'title', 'creator', 'licenseurl']) u.searchParams.append('fl[]', f);
  u.searchParams.append('sort[]', 'downloads desc');
  u.searchParams.set('rows', String(Math.min(limit * 2, 50)));
  u.searchParams.set('page', '1');
  u.searchParams.set('output', 'json');
  const r = await getJson(u.toString(), 6500);
  const docs = (r.data && r.data.response && r.data.response.docs) || [];
  const items = docs
    .filter((d) => d && IA_ID.test(String(d.identifier || '')) && CC_URL.test(String(first(d.licenseurl) || '')) && !isNC(first(d.licenseurl)))
    .slice(0, limit)
    .map((d) => ({
      videoId: `ia_${d.identifier}`,
      title: String(first(d.title) || 'Untitled').slice(0, 200),
      artist: String(first(d.creator) || 'Unknown artist').slice(0, 120),
      thumbnail: `https://archive.org/services/img/${d.identifier}`,
      duration: '',
      source: 'archive',
      license: ccLabel(first(d.licenseurl)),
      verified: false,
    }));
  return { items, why: r.why };
}

// Picks the best MP3 of an archive.org item. Re-checks the licence, so an id typed by hand
// can never be used to pull an unlicensed or NonCommercial item through this server.
export async function archiveFileUrl(identifier) {
  if (!IA_ID.test(String(identifier || ''))) return null;
  const r = await getJson(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, 7000);
  const d = r.data;
  if (!d || !d.metadata) return null;
  const lic = String(first(d.metadata.licenseurl) || '');
  if (!CC_URL.test(lic) || isNC(lic)) return null;
  const files = Array.isArray(d.files) ? d.files : [];
  for (const fmt of ['VBR MP3', '128Kbps MP3', '64Kbps MP3', 'MP3', 'Ogg Vorbis']) {
    const f = files.find((x) => x && x.format === fmt && x.name);
    if (f) return `https://archive.org/download/${encodeURIComponent(identifier)}/${String(f.name).split('/').map(encodeURIComponent).join('/')}`;
  }
  return null;
}

let ovTok = { v: null, exp: 0 };
async function openverseAuth() {
  const id = process.env.OPENVERSE_CLIENT_ID;
  const secret = process.env.OPENVERSE_CLIENT_SECRET;
  if (!id || !secret) return undefined;
  if (ovTok.v && Date.now() < ovTok.exp) return { Authorization: `Bearer ${ovTok.v}` };
  try {
    const r = await fetch('https://api.openverse.org/v1/auth_tokens/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'sarmaxstream/1.0' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }).toString(),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return undefined;
    const d = await r.json();
    if (!d || !d.access_token) return undefined;
    ovTok = { v: d.access_token, exp: Date.now() + Math.max(60, (Number(d.expires_in) || 3600) - 120) * 1000 };
    return { Authorization: `Bearer ${ovTok.v}` };
  } catch { return undefined; }
}

export async function searchOpenverse(query, limit) {
  const u = new URL('https://api.openverse.org/v1/audio/');
  u.searchParams.set('q', query);
  u.searchParams.set('page_size', String(Math.min(limit, 20)));
  u.searchParams.set('license_type', 'commercial');
  u.searchParams.set('category', 'music');
  const r = await getJson(u.toString(), 6500, await openverseAuth());
  const items = ((r.data && r.data.results) || [])
    .filter((t) => t && OV_ID.test(String(t.id || '')) && t.url && !isNC(t.license))
    .map((t) => ({
      videoId: `ov_${t.id}`,
      title: String(t.title || 'Untitled').slice(0, 200),
      artist: String(t.creator || 'Unknown artist').slice(0, 120),
      thumbnail: t.thumbnail || '',
      duration: secToIso((Number(t.duration) || 0) / 1000),
      source: 'openverse',
      license: ccLabel(t.license, t.license_version),
      verified: false,
    }));
  return { items, why: r.why };
}

// Looks the real audio file up on Openverse (never taken from the caller). https only.
export async function openverseAudioUrl(uuid) {
  if (!OV_ID.test(String(uuid || ''))) return null;
  const r = await getJson(`https://api.openverse.org/v1/audio/${uuid}/`, 6500, await openverseAuth());
  const d = r.data;
  if (!d || !d.url || isNC(d.license)) return null;
  try {
    const u = new URL(d.url);
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.hostname.includes(':') || /^[\d.]+$/.test(u.hostname)) return null;
    return u.toString();
  } catch { return null; }
}

'''

NEW_TAIL = r'''// All four free sources in parallel, junk filtered, interleaved so each one shows up.
// Returns { tracks, diag } where diag explains what each source did.
export async function searchFree(query, max = 24) {
  const per = Math.min(Math.max(max, 10), 30);
  const empty = { items: [], why: 'crashed' };
  const [a, j, o, i] = await Promise.all([
    searchAudius(query, per).catch(() => empty),
    searchJamendo(query, per).catch(() => empty),
    searchOpenverse(query, per).catch(() => empty),
    searchArchive(query, per).catch(() => empty),
  ]);
  const lists = [j, a, o, i].map((s) => s.items.filter((t) => official(t, query)));
  const longest = Math.max(0, ...lists.map((l) => l.length));
  const seen = new Set();
  const out = [];
  for (let k = 0; k < longest; k++) {
    for (const l of lists) {
      const t = l[k];
      if (!t) continue;
      const key = `${norm(t.artist)}|${norm(t.title)}`; // Openverse also carries Jamendo tracks
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return {
    tracks: out.slice(0, max).map(({ _verified, _plays, ...t }) => t),
    diag: {
      audius: `${a.why} (${a.items.length} found)`,
      jamendo: `${j.why} (${j.items.length} found)`,
      openverse: `${o.why} (${o.items.length} found)`,
      archive: `${i.why} (${i.items.length} found)`,
    },
  };
}
'''

if os.path.exists(F):
    t = read(F)
    if "export async function searchArchive" in t:
        print("  skip (already applied): free: new sources + searchFree")
    else:
        marker = "// Audius + Jamendo in parallel, junk filtered, interleaved so both show up."
        k = t.find(marker)
        if k == -1:
            FAILED.append("free: could not find the old searchFree block")
        else:
            write(F, t[:k] + NEW_SECTION + NEW_TAIL)
            print("  ok: free: new sources + searchFree")

# ===================================================================== api/stream.js
S = "api/stream.js"
print("[2] api/stream.js: stream ia_ / ov_ ids")
edit(S, "import { rateLimit, makeCache } from './_guard.js';",
        "import { rateLimit, makeCache } from './_guard.js';\nimport { archiveFileUrl, openverseAudioUrl } from './_free.js';",
     marker="archiveFileUrl", label="stream: import helpers")
edit(S, "  const jam = /^jam_(\\d{1,10})$/.exec(id);\n  if (!aud && !jam) return res.status(400).json({ error: 'Bad id' });",
        "  const jam = /^jam_(\\d{1,10})$/.exec(id);\n  const ia = /^ia_([A-Za-z0-9][A-Za-z0-9._-]{0,99})$/.exec(id);\n  const ov = /^ov_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(id);\n  if (!aud && !jam && !ia && !ov) return res.status(400).json({ error: 'Bad id' });",
     marker="const ia = /^ia_", label="stream: accept the new id shapes")
edit(S, "    } else {\n      const cid = process.env.JAMENDO_CLIENT_ID;",
        "    } else if (ia || ov) {\n      target = ia ? await archiveFileUrl(ia[1]) : await openverseAudioUrl(ov[1]);\n      if (!target) return res.status(404).json({ error: 'Track not found or not openly licensed' });\n    } else {\n      const cid = process.env.JAMENDO_CLIENT_ID;",
     marker="} else if (ia || ov) {", label="stream: resolve the real file")
edit(S, "// api/stream.js — GET /api/stream?id=aud_XXXX | jam_12345",
        "// api/stream.js — GET /api/stream?id=aud_XXXX | jam_12345 | ia_identifier | ov_uuid",
     marker="| ia_identifier | ov_uuid", label="stream: header comment")

# ===================================================================== api/searchMusic.js
M = "api/searchMusic.js"
print("[3] api/searchMusic.js: mode 'free'")
edit(M, "  // ---- SEARCH: free catalogs (Deezer / iTunes). No YouTube quota is spent on searching. ----",
'''  // ---- FREE: only openly licensed music (Audius, Jamendo, Openverse, Internet Archive) ----
  if (mode === 'free' && query && !pageToken) {
    const fmax = Math.min(Number(body.maxResults) || 12, 30);
    const fkey = JSON.stringify(['free1', query.toLowerCase(), fmax]);
    const fhit = resultCache.get(fkey);
    if (fhit) { res.setHeader('X-Cache', 'HIT'); return res.status(200).json(fhit); }
    if (!rateLimit(req, res, { name: 'music', max: 40, windowMs: 60 * 1000 })) return undefined;
    try {
      const f = await searchFree(query, fmax);
      const fpayload = { tracks: f.tracks, artist: null, nextPageToken: '' };
      if (f.tracks.length) resultCache.set(fkey, fpayload);
      return res.status(200).json(body.debug && process.env.ALLOW_DEBUG === '1' ? { ...fpayload, diag: f.diag } : fpayload);
    } catch {
      return res.status(200).json({ tracks: [], artist: null, nextPageToken: '' });
    }
  }

  // ---- SEARCH: free catalogs (Deezer / iTunes). No YouTube quota is spent on searching. ----''',
     marker="mode === 'free' && query", label="searchMusic: add 'free' mode")

# ===================================================================== client
print("[4] client: ids, list label, search section, friendlier error")
edit("src/lib/PlayerContext.jsx",
     "const isAudioId = (id) => typeof id === 'string' && (id.startsWith('aud_') || id.startsWith('jam_'));",
     "const isAudioId = (id) => typeof id === 'string' && /^(aud|jam|ia|ov)_/.test(id);",
     marker="/^(aud|jam|ia|ov)_/.test(id)", label="player: recognise ia_/ov_ ids")
edit("src/lib/downloadManager.js",
     "const isAudioId = (id) => typeof id === 'string' && (id.startsWith('aud_') || id.startsWith('jam_'));",
     "const isAudioId = (id) => typeof id === 'string' && /^(aud|jam|ia|ov)_/.test(id);",
     marker="/^(aud|jam|ia|ov)_/.test(id)", label="downloads: recognise ia_/ov_ ids")
edit("src/lib/downloadManager.js", "  return 'Download failed.';\n}",
     "  if (/cobalt|tunnel|youtube/i.test(m))\n    return \"This song can't be downloaded. Songs in the “Free to download” list can be saved.\";\n  return 'Download failed.';\n}",
     marker="Free to download” list can be saved", label="downloads: clear message instead of 'cobalt 404'")
edit("src/components/MusicLayout.jsx", "/^(aud|jam)_|^(dz|it)_\\d+$/.test(v)", "/^(aud|jam|ia|ov)_|^(dz|it)_\\d+$/.test(v)",
     marker="/^(aud|jam|ia|ov)_|", label="layout: no YouTube thumbnail for the new ids")
edit("src/components/TrackList.jsx",
     '<div className="truncate text-xs text-white/50">{t.artist}</div>',
     '<div className="truncate text-xs text-white/50">{t.artist}{t.license ? <span className="text-white/30"> · {t.license}</span> : null}</div>',
     marker="{t.license ?", label="tracklist: show the licence")

R = "src/pages/SearchResults.jsx"
edit(R, "  const [why, setWhy] = useState(null);", "  const [why, setWhy] = useState(null);\n  const [free, setFree] = useState([]);",
     marker="useState([]);\n", label="search: state") if False else None
t = read(R) if os.path.exists(R) else ""
if "const [free, setFree]" in t:
    print("  skip (already applied): search page")
elif t:
    pairs = [
        ("  const [why, setWhy] = useState(null);", "  const [why, setWhy] = useState(null);\n  const [free, setFree] = useState([]);"),
        ("if (!q) { setTracks([]); setArtists([]); setLoading(false); return undefined; }",
         "if (!q) { setTracks([]); setArtists([]); setFree([]); setLoading(false); return undefined; }"),
        ("      const songs = await post({ query: q, mode: 'search', maxResults: 25 }).catch(() => ({}));",
         "      const [songs, fr] = await Promise.all([\n        post({ query: q, mode: 'search', maxResults: 25 }).catch(() => ({})),\n        post({ query: q, mode: 'free', maxResults: 12 }).catch(() => ({})),\n      ]);"),
        ("      setTracks(songs.tracks || []);", "      setTracks(songs.tracks || []);\n      setFree(fr.tracks || []);"),
        ('            emptyText="No songs found. Try another search."\n          />\n',
         '            emptyText="No songs found. Try another search."\n          />\n'
         '          {free.length > 0 && (\n'
         '            <section className="space-y-3">\n'
         '              <h2 className="text-lg font-semibold text-white/90">Free to download</h2>\n'
         '              <p className="text-xs text-white/40">Creative Commons and public-domain music. You can save these for offline listening; keep the credit if you reuse them.</p>\n'
         '              <TrackList\n'
         '                tracks={free}\n'
         '                savedIds={lib.savedIds}\n'
         '                playlists={lib.playlists}\n'
         '                onToggleSave={lib.toggleSave}\n'
         '                onCreatePlaylist={lib.createPlaylist}\n'
         '                onAddToPlaylist={lib.addToPlaylist}\n'
         '                emptyText=""\n'
         '              />\n'
         '            </section>\n'
         '          )}\n'),
    ]
    ok = True
    for old, new in pairs:
        if old not in t:
            FAILED.append(f"search page: {old[:50]!r}"); ok = False; break
    if ok:
        for old, new in pairs:
            t = t.replace(old, new, 1)
        write(R, t); print("  ok: search page: 'Free to download' section")

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
echo "  1. npm ci && npm run build"
echo "  2. (optional) free account at api.openverse.org -> set OPENVERSE_CLIENT_ID and OPENVERSE_CLIENT_SECRET in Vercel"
echo "  3. git add -A && git commit -m 'Add Internet Archive + Openverse free music' && git push origin main"
echo "  4. After deploy: search a band name, scroll to 'Free to download', play one, then press download on it"
exit $rc
