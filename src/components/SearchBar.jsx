import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// base44 removed — using fetch to /api/searchMusic instead
import { usePlayer } from '@/lib/PlayerContext';
import { Search, Play, X } from 'lucide-react';

export default function SearchBar({ initial = '' }) {
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const player = usePlayer();
  const boxRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    const v = q.trim();
    if (v.length < 2) { setResults([]); setOpen(false); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/searchMusic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: v, mode: 'search', maxResults: 6 }) }).then(r => r.json());
        setResults(res.tracks || []);
        setOpen(true);
      } catch {}
      setLoading(false);
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    const v = q.trim();
    if (v) { setOpen(false); navigate(`/music/search?q=${encodeURIComponent(v)}`); }
  };

  const pick = (t) => { player.playTrack(t, results); setOpen(false); };

  return (
    <div className="relative w-full max-w-xl" ref={boxRef}>
      <form onSubmit={submit} className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search any song, artist, or album…"
          className="w-full glass rounded-full pl-12 pr-10 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary/60 border border-white/10"
        />
        {q && (
          <button type="button" onClick={() => { setQ(''); setResults([]); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
            <X size={16} />
          </button>
        )}
      </form>

      {open && (results.length > 0 || loading) && (
        <div className="absolute top-full mt-2 w-full glass-strong rounded-2xl p-2 z-50 max-h-[60vh] overflow-auto shadow-2xl">
          {loading && <div className="px-3 py-2 text-xs text-white/40">Searching…</div>}
          {results.map((t) => (
            <button key={t.videoId} onClick={() => pick(t)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/10 text-left">
              <img src={t.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-white">{t.title}</div>
                <div className="truncate text-xs text-white/50">{t.artist}</div>
              </div>
              <Play size={16} className="text-white/40 shrink-0" />
            </button>
          ))}
          <button onClick={submit} className="w-full text-left px-3 py-2.5 mt-1 rounded-xl hover:bg-white/10 text-sm text-primary">
            See artists for “{q}” →
          </button>
        </div>
      )}
    </div>
  );
}
