import React, { useState, useRef, useEffect } from 'react';
import { ListPlus, Plus } from 'lucide-react';

export default function AddToPlaylistMenu({ track, playlists, onCreate, onAdd }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const add = (id) => { onAdd(id, track); setOpen(false); };
  const create = async () => {
    if (!newName.trim()) return;
    const pl = await onCreate(newName);
    setNewName('');
    if (pl) onAdd(pl.id, track);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="p-1.5 rounded-lg text-white/50 hover:text-primary hover:bg-white/5" title="Add to playlist">
        <ListPlus size={17} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-56 glass-strong rounded-2xl p-2 shadow-2xl">
          <div className="max-h-52 overflow-auto">
            {playlists.length === 0 && <div className="px-3 py-2 text-xs text-white/40">No playlists yet</div>}
            {playlists.map((pl) => (
              <button key={pl.id} onClick={() => add(pl.id)} className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10 truncate">
                {pl.name}
              </button>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-2 px-2 py-2 border-t border-white/10">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New playlist" className="flex-1 bg-white/5 rounded-lg px-2 py-1.5 text-sm outline-none border border-white/10" />
            <button onClick={create} className="p-1.5 rounded-lg bg-primary text-primary-foreground"><Plus size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
