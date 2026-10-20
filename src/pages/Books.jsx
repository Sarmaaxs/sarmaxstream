import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, BookOpen, X, Bookmark, Sparkles, Clock, Download } from 'lucide-react';
import Navbar from '@/components/Navbar';
import BookCover from '@/components/BookCover';
import { continueReading, getSaved, getDownloaded, fetchJsonRetry } from '@/lib/books';
import { isNative } from '@/lib/native';

async function api(body) {
  return fetchJsonRetry('/api/searchBooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 3, 30 * 60 * 1000);
}

// Author searches work well with the book catalogue.
const AUTHORS = ['Jane Austen', 'Charles Dickens', 'Mark Twain', 'Arthur Conan Doyle', 'H. G. Wells', 'Edgar Allan Poe', 'Jules Verne', 'Oscar Wilde', 'Shakespeare', 'Dostoyevsky'];

function pctOf(progress) {
  return progress && progress.total ? Math.round(((progress.page + 1) / progress.total) * 100) : 0;
}

function BookCard({ b, progress }) {
  const pct = pctOf(progress);
  return (
    <Link to={`/books/read/${b.id}`} className="group block focus:outline-none">
      <div className="relative transition-transform duration-300 group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5">
        <BookCover book={b} className="shadow-lg shadow-black/40 ring-1 ring-white/10 group-hover:ring-primary/50 group-focus-visible:ring-primary" />
        {pct > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/60">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="mt-2.5 px-0.5">
        <div className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">{b.title}</div>
        <div className="text-xs text-white/50 truncate mt-0.5">{b.author}</div>
      </div>
    </Link>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 text-lg sm:text-xl font-display font-bold mb-4 text-white/95">
      {Icon && <Icon size={18} className="text-primary" />} {children}
    </h2>
  );
}

function Grid({ books, progress }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-4 gap-y-7">
      {books.map((b) => <BookCard key={b.id} b={b} progress={progress ? progress[b.id] : null} />)}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-4 gap-y-7">
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-white/5 animate-pulse mt-3" />
          <div className="h-3 w-1/2 rounded bg-white/5 animate-pulse mt-2" />
        </div>
      ))}
    </div>
  );
}

function ContinueRow({ items }) {
  if (!items.length) return null;
  return (
    <section>
      <SectionTitle icon={Clock}>Continue reading</SectionTitle>
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
        {items.map((r) => {
          const pct = pctOf(r);
          return (
            <Link key={r.id} to={`/books/read/${r.id}`} className="snap-start shrink-0 w-[22rem] max-w-[85vw] flex gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-primary/40 transition">
              <div className="w-16 shrink-0"><BookCover book={r} className="shadow-md shadow-black/40" /></div>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <div className="text-sm font-semibold line-clamp-2 leading-snug">{r.title}</div>
                <div className="text-xs text-white/50 truncate mt-0.5">{r.author}</div>
                <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.max(pct, 2)}%` }} /></div>
                <div className="text-[11px] text-white/50 mt-1.5">{pct}% read · page {r.page + 1}{r.total ? ` of ${r.total}` : ''}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function Books() {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [books, setBooks] = useState([]);
  const [popular, setPopular] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resume, setResume] = useState([]);
  const [saved, setSaved] = useState([]);
  const [downloaded, setDownloaded] = useState([]);

  useEffect(() => { setResume(continueReading()); setSaved(getSaved()); if (isNative) setDownloaded(getDownloaded()); }, []);

  // search while typing (waits until you pause), or instantly on Enter / chip tap
  useEffect(() => {
    const v = q.trim();
    if (v === term) return undefined;
    if (v.length === 1) return undefined;
    const t = setTimeout(() => setTerm(v), 450);
    return () => clearTimeout(t);
  }, [q, term]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const res = term ? await api({ mode: 'search', query: term }) : await api({ mode: 'popular' });
        if (!active) return;
        if (res.error && !(res.books && res.books.length)) setError(res.error);
        if (term) setBooks(res.books || []); else setPopular(res.books || []);
      } catch {
        if (active) setError('Could not reach the book library. Check your connection.');
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [term]);

  const submit = (e) => { e.preventDefault(); setTerm(q.trim()); };
  const pick = (name) => { setQ(name); setTerm(name); };
  const clear = () => { setQ(''); setTerm(''); };
  const progressMap = Object.fromEntries(resume.map((r) => [r.id, r]));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-nav pb-page mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 space-y-10">
        {/* hero */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent px-5 py-8 sm:px-10 sm:py-12 text-center">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <h1 className="relative font-display font-extrabold tracking-tight text-4xl sm:text-5xl flex items-center justify-center gap-3">
            <BookOpen className="text-primary" size={38} /> Books
          </h1>
          <p className="relative mt-3 text-sm sm:text-base text-white/55 max-w-lg mx-auto">Thousands of classic books, free to read right here. Your page is saved automatically.</p>
          <form onSubmit={submit} className="relative mt-6 mx-auto w-full max-w-xl" role="search">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title or author…"
              enterKeyHint="search"
              autoComplete="off"
              className="w-full h-12 rounded-full bg-black/40 pl-12 pr-11 text-base text-white placeholder:text-white/40 outline-none border border-white/15 focus:border-primary/70 focus:ring-2 focus:ring-primary/30"
            />
            {(q || term) && (
              <button type="button" aria-label="Clear" onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10"><X size={16} /></button>
            )}
          </form>
          <div className="relative mt-5 flex gap-2 overflow-x-auto no-scrollbar justify-start sm:justify-center sm:flex-wrap pb-1">
            {AUTHORS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => pick(a)}
                className={`shrink-0 h-8 px-3.5 rounded-full text-xs font-medium border transition ${term === a ? 'bg-primary text-primary-foreground border-primary' : 'bg-white/5 border-white/15 text-white/75 hover:bg-white/10'}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {!term && <ContinueRow items={resume.slice(0, 10)} />}
        {!term && isNative && downloaded.length > 0 && (
          <section>
            <SectionTitle icon={Download}>Downloaded · works offline</SectionTitle>
            <Grid books={downloaded} progress={progressMap} />
          </section>
        )}
        {!term && saved.length > 0 && (
          <section>
            <SectionTitle icon={Bookmark}>Saved for later</SectionTitle>
            <Grid books={saved.slice(0, 14)} progress={progressMap} />
          </section>
        )}

        <section>
          <SectionTitle icon={term ? Search : Sparkles}>{term ? `Results for “${term}”` : 'Popular classics'}</SectionTitle>
          {loading ? (
            <SkeletonGrid />
          ) : error ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-center text-sm text-white/55">{error}</div>
          ) : term ? (
            books.length ? <Grid books={books} progress={progressMap} />
              : <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-center text-sm text-white/55">No books found. Try a different title or author.</div>
          ) : (
            <Grid books={popular} progress={progressMap} />
          )}
        </section>

        <p className="text-center text-xs text-white/30 pb-4">Books come from Project Gutenberg — free, public-domain works.</p>
      </div>
    </div>
  );
}
