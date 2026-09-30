import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2, BookOpen, X } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { continueReading, getSaved, fetchJsonRetry } from '@/lib/books';

async function api(body) {
  return fetchJsonRetry('/api/searchBooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function BookCard({ b, progress }) {
  const pct = progress && progress.total ? Math.round(((progress.page + 1) / progress.total) * 100) : 0;
  return (
    <Link to={`/books/read/${b.id}`} className="group block">
      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 relative">
        {b.cover ? (
          <img src={b.cover} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition" />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 text-center text-sm text-white/60">{b.title}</div>
        )}
        {pct > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/50"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
        )}
      </div>
      <div className="mt-2 text-sm font-medium line-clamp-2 leading-snug">{b.title}</div>
      <div className="text-xs text-white/50 truncate">{b.author}</div>
    </Link>
  );
}

function Shelf({ title, books, progress }) {
  if (!books.length) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3 text-white/90">{title}</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
        {books.map((b) => <BookCard key={b.id} b={b} progress={progress ? progress[b.id] : null} />)}
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

  useEffect(() => { setResume(continueReading()); setSaved(getSaved()); }, []);

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
  const progressMap = Object.fromEntries(resume.map((r) => [r.id, r]));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-nav pb-page mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 space-y-8">
        <div className="flex flex-col items-center text-center gap-4 pt-2">
          <h1 className="font-display font-extrabold tracking-tight text-4xl sm:text-5xl flex items-center gap-3">
            <BookOpen className="text-primary" size={36} /> Books
          </h1>
          <p className="text-sm text-white/50 max-w-md">Thousands of classic books, free to read right here. Your place is saved automatically.</p>
          <form onSubmit={submit} className="relative w-full max-w-xl" role="search">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title or author…"
              enterKeyHint="search"
              className="w-full glass rounded-full pl-12 pr-10 py-3 text-base text-white placeholder:text-white/40 outline-none border border-white/10 focus:border-primary/60"
            />
            {(q || term) && (
              <button type="button" aria-label="Clear" onClick={() => { setQ(''); setTerm(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40"><X size={16} /></button>
            )}
          </form>
        </div>

        {!term && <Shelf title="Continue reading" books={resume.slice(0, 8)} progress={progressMap} />}
        {!term && <Shelf title="Saved for later" books={saved.slice(0, 16)} progress={progressMap} />}

        {loading ? (
          <div className="flex justify-center py-16 text-white/40"><Loader2 className="animate-spin" /></div>
        ) : error ? (
          <div className="glass rounded-2xl py-10 text-center text-sm text-white/50">{error}</div>
        ) : term ? (
          books.length ? <Shelf title={`Results for “${term}”`} books={books} progress={progressMap} />
            : <div className="glass rounded-2xl py-10 text-center text-sm text-white/50">No books found. Try a different title or author.</div>
        ) : (
          <Shelf title="Popular classics" books={popular} progress={progressMap} />
        )}

        <p className="text-center text-xs text-white/30 pb-4">Books come from Project Gutenberg — free, public-domain works.</p>
      </div>
    </div>
  );
}
