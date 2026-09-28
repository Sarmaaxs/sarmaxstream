// api/bookText.js — returns the plain text of a Project Gutenberg book.
// GET /api/bookText?id=1342
// Only ever fetches gutenberg.org, and only by numeric id (no open proxy).
import { rateLimit } from './_guard.js';

const MAX_CHARS = 3_800_000; // stay under Vercel's ~4.5 MB response limit

async function tryFetch(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!r.ok) return null;
    const txt = await r.text();
    return txt && txt.length > 500 ? txt : null;
  } catch { return null; } finally { clearTimeout(t); }
}

function stripBoilerplate(text) {
  let t = text.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  const start = t.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  if (start >= 0) t = t.slice(t.indexOf('\n', start) + 1);
  const end = t.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (end >= 0) t = t.slice(0, end);
  return t.trim();
}

export default async function handler(req, res) {
  const id = String((req.query && req.query.id) || '');
  if (!/^\d{1,7}$/.test(id)) return res.status(400).json({ error: 'Bad id' });
  if (!rateLimit(req, res, { name: 'booktext', max: 20, windowMs: 60 * 1000 })) return undefined;

  const urls = [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`,
  ];
  let raw = null;
  for (const u of urls) { raw = await tryFetch(u); if (raw) break; }
  if (!raw) return res.status(404).json({ error: "This book's text isn't available." });

  let text = stripBoilerplate(raw);
  let truncated = false;
  if (text.length > MAX_CHARS) { text = text.slice(0, MAX_CHARS); truncated = true; }

  // Books never change: let the CDN and browser keep them for a week.
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
  return res.status(200).json({ text, truncated });
}
