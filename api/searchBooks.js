// api/searchBooks.js — free, legal, readable books (Project Gutenberg).
// No API key needed.
//   POST/GET { mode: 'search', query }   -> search
//   POST/GET { mode: 'popular' }         -> most downloaded
//   POST/GET { mode: 'get', id }         -> one book's details
//
// Gutendex (the nice JSON API) is often slow or down. So we:
//   1) try Gutendex, 2) if it hasn't answered in ~3s ALSO ask Gutenberg's own
//   OPDS catalog and take whichever answers first, 3) fall back to the last good
//   answer we remember, 4) finally a built-in shelf of classics. It never just fails.
import { rateLimit, makeCache, parseBody } from './_guard.js';

const fresh = makeCache({ ttlMs: 30 * 60 * 1000, max: 300 });
const stale = makeCache({ ttlMs: 24 * 60 * 60 * 1000, max: 300 });

const cover = (id) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;

const CLASSICS = [
  [1342, 'Pride and Prejudice', 'Jane Austen'], [84, 'Frankenstein', 'Mary Wollstonecraft Shelley'],
  [2701, 'Moby Dick', 'Herman Melville'], [11, "Alice's Adventures in Wonderland", 'Lewis Carroll'],
  [1661, 'The Adventures of Sherlock Holmes', 'Arthur Conan Doyle'], [345, 'Dracula', 'Bram Stoker'],
  [1400, 'Great Expectations', 'Charles Dickens'], [1260, 'Jane Eyre', 'Charlotte Brontë'],
  [98, 'A Tale of Two Cities', 'Charles Dickens'], [174, 'The Picture of Dorian Gray', 'Oscar Wilde'],
  [1727, 'The Odyssey', 'Homer'], [2554, 'Crime and Punishment', 'Fyodor Dostoyevsky'],
  [1232, 'The Prince', 'Niccolò Machiavelli'], [76, 'Adventures of Huckleberry Finn', 'Mark Twain'],
  [74, 'The Adventures of Tom Sawyer', 'Mark Twain'], [2600, 'War and Peace', 'Leo Tolstoy'],
  [1952, 'The Yellow Wallpaper', 'Charlotte Perkins Gilman'], [43, 'The Strange Case of Dr. Jekyll and Mr. Hyde', 'Robert Louis Stevenson'],
  [219, 'Heart of Darkness', 'Joseph Conrad'], [64317, 'The Great Gatsby', 'F. Scott Fitzgerald'],
  [16328, 'Beowulf', 'Unknown'], [36, 'The War of the Worlds', 'H. G. Wells'],
  [35, 'The Time Machine', 'H. G. Wells'], [120, 'Treasure Island', 'Robert Louis Stevenson'],
  [1184, 'The Count of Monte Cristo', 'Alexandre Dumas'], [2814, 'Dubliners', 'James Joyce'],
  [158, 'Emma', 'Jane Austen'], [161, 'Sense and Sensibility', 'Jane Austen'],
].map(([id, title, author]) => ({ id, title, author, cover: cover(id), downloads: 0, subjects: [], language: 'en' }));

function withTimeout(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

async function fetchText(url, ms, accept) {
  const to = withTimeout(ms);
  try {
    const r = await fetch(url, { signal: to.signal, headers: { Accept: accept, 'User-Agent': 'SarmaxStream/1.0' } });
    if (!r.ok) throw new Error(`status ${r.status}`);
    return await r.text();
  } finally { to.done(); }
}

// ---------- Gutendex ----------
function shape(b) {
  const fm = b.formats || {};
  const authors = (b.authors || []).map((a) => {
    const parts = (a.name || '').split(',').map((x) => x.trim()).filter(Boolean);
    return parts.length === 2 ? `${parts[1]} ${parts[0]}` : (a.name || '');
  });
  return {
    id: b.id,
    title: b.title || 'Untitled',
    author: authors.join(', ') || 'Unknown author',
    cover: fm['image/jpeg'] || cover(b.id),
    downloads: b.download_count || 0,
    subjects: (b.subjects || []).slice(0, 3),
    language: (b.languages || [])[0] || 'en',
  };
}

async function viaGutendex(mode, query, page, id) {
  let url;
  if (mode === 'get') url = `https://gutendex.com/books/${id}`;
  else if (mode === 'popular') url = `https://gutendex.com/books/?languages=en&page=${page}`;
  else url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}&languages=en&page=${page}`;
  const txt = await fetchText(url, 9000, 'application/json');
  const data = JSON.parse(txt);
  if (mode === 'get') { if (!data || !data.id) throw new Error('no book'); return { book: shape(data) }; }
  return { books: (data.results || []).map(shape), next: !!data.next };
}

// ---------- Gutenberg OPDS (their own catalog, no JSON but reliable) ----------
const unxml = (s) => (s || '').replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").trim();

function parseOpds(xml) {
  const out = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const idm = /\/ebooks\/(\d+)(?:\.opds)?\s*<\/id>/.exec(e) || /href="\/ebooks\/(\d+)\.opds"/.exec(e);
    if (!idm) continue;
    const title = unxml((/<title>([\s\S]*?)<\/title>/.exec(e) || [])[1]);
    const author = unxml((/<content[^>]*>([\s\S]*?)<\/content>/.exec(e) || [])[1]);
    const id = Number(idm[1]);
    if (!title) continue;
    out.push({ id, title, author: author || 'Unknown author', cover: cover(id), downloads: 0, subjects: [], language: 'en' });
  }
  return out;
}

async function viaOpds(mode, query, page, id) {
  if (mode === 'get') {
    const xml = await fetchText(`https://www.gutenberg.org/ebooks/${id}.opds`, 9000, 'application/atom+xml, text/xml');
    const list = parseOpds(xml);
    const b = list.find((x) => x.id === Number(id)) || list[0];
    if (!b) throw new Error('no book');
    return { book: { ...b, id: Number(id) } };
  }
  const start = (page - 1) * 25 + 1;
  const url = mode === 'popular'
    ? `https://www.gutenberg.org/ebooks/search.opds/?sort_order=downloads&start_index=${start}`
    : `https://www.gutenberg.org/ebooks/search.opds/?query=${encodeURIComponent(query)}&start_index=${start}`;
  const xml = await fetchText(url, 9000, 'application/atom+xml, text/xml');
  const books = parseOpds(xml);
  if (!books.length && mode === 'popular') throw new Error('empty');
  return { books, next: books.length >= 25 };
}

// Gutendex first; if it's slow (>3s) start OPDS too and take whichever succeeds first.
function firstGood(mode, query, page, id) {
  return new Promise((resolve, reject) => {
    let failed = 0;
    let opdsStarted = false;
    const onFail = () => {
      failed += 1;
      if (!opdsStarted) startOpds();
      else if (failed >= 2) reject(new Error('all sources failed'));
    };
    function startOpds() {
      if (opdsStarted) return;
      opdsStarted = true;
      viaOpds(mode, query, page, id).then(resolve, onFail);
    }
    const timer = setTimeout(startOpds, 3000);
    viaGutendex(mode, query, page, id).then(
      (v) => { clearTimeout(timer); resolve(v); },
      () => { clearTimeout(timer); onFail(); },
    );
  });
}

function offline(mode, query, id) {
  if (mode === 'get') {
    const b = CLASSICS.find((x) => String(x.id) === String(id));
    return b ? { book: b } : null;
  }
  if (mode === 'popular') return { books: CLASSICS, next: false, offline: true };
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = CLASSICS.filter((b) => words.every((w) => `${b.title} ${b.author}`.toLowerCase().includes(w)));
  return { books: hits, next: false, offline: true };
}

export default async function handler(req, res) {
  const body = parseBody(req);
  const mode = body.mode || 'search';
  const query = String(body.query || '').trim().slice(0, 100);
  const page = Math.max(1, Math.min(50, parseInt(body.page, 10) || 1));
  const id = String(body.id || '');

  if (mode === 'get' && !/^\d{1,7}$/.test(id)) return res.status(400).json({ error: 'Bad id' });
  if (mode === 'search' && !query) return res.status(200).json({ books: [], next: false });

  const key = JSON.stringify([mode, query.toLowerCase(), page, id]);
  const hit = fresh.get(key);
  if (hit) { res.setHeader('X-Cache', 'HIT'); return res.status(200).json(hit); }
  if (!rateLimit(req, res, { name: 'books', max: 40, windowMs: 60 * 1000 })) return undefined;

  try {
    const out = await firstGood(mode, query, page, id);
    fresh.set(key, out);
    stale.set(key, out);
    return res.status(200).json(out);
  } catch {
    const old = stale.get(key);
    if (old) { res.setHeader('X-Cache', 'STALE'); return res.status(200).json(old); }
    const off = offline(mode, query, id);
    if (off) return res.status(200).json(off);
    return res.status(502).json({ error: 'The book library is busy right now. Try again in a moment.', books: [] });
  }
}
