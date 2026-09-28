// api/searchBooks.js — free, legal, readable books (Project Gutenberg via Gutendex).
// No API key needed.
//   POST/GET { mode: 'search', query }   -> search
//   POST/GET { mode: 'popular' }         -> most downloaded
//   POST/GET { mode: 'get', id }         -> one book's details
import { rateLimit, makeCache, parseBody } from './_guard.js';

const cache = makeCache({ ttlMs: 30 * 60 * 1000, max: 300 });

async function fetchJson(url, ms = 9000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`Book source error ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function shape(b) {
  const fm = b.formats || {};
  const authors = (b.authors || []).map((a) => {
    // Gutenberg stores "Last, First" — show "First Last".
    const parts = (a.name || '').split(',').map((x) => x.trim()).filter(Boolean);
    return parts.length === 2 ? `${parts[1]} ${parts[0]}` : (a.name || '');
  });
  return {
    id: b.id,
    title: b.title || 'Untitled',
    author: authors.join(', ') || 'Unknown author',
    cover: fm['image/jpeg'] || '',
    downloads: b.download_count || 0,
    subjects: (b.subjects || []).slice(0, 3),
    language: (b.languages || [])[0] || 'en',
  };
}

export default async function handler(req, res) {
  try {
    const body = parseBody(req);
    const mode = body.mode || 'search';
    const query = String(body.query || '').trim().slice(0, 100);
    const page = Math.max(1, Math.min(50, parseInt(body.page, 10) || 1));
    const id = String(body.id || '');

    let url;
    if (mode === 'get') {
      if (!/^\d{1,7}$/.test(id)) return res.status(400).json({ error: 'Bad id' });
      url = `https://gutendex.com/books/${id}`;
    } else if (mode === 'popular') {
      url = `https://gutendex.com/books/?languages=en&page=${page}`;
    } else {
      if (!query) return res.status(200).json({ books: [], next: false });
      url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}&languages=en&page=${page}`;
    }

    const key = url;
    const hit = cache.get(key);
    if (hit) { res.setHeader('X-Cache', 'HIT'); return res.status(200).json(hit); }
    if (!rateLimit(req, res, { name: 'books', max: 40, windowMs: 60 * 1000 })) return undefined;

    const data = await fetchJson(url);
    const out = mode === 'get'
      ? { book: shape(data) }
      : { books: (data.results || []).map(shape), next: !!data.next };
    cache.set(key, out);
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: 'The book library is busy right now. Try again in a moment.', books: [] });
  }
}
