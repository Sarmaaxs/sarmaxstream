import React, { useEffect, useRef, useState } from 'react';

// Nice-looking cover for every book. If the real cover is missing, slow or broken,
// a generated one (colour + title + author) is shown instead of an ugly empty box.
const PALETTES = [
  ['#9a3412', '#431407'], ['#1d4ed8', '#172554'], ['#15803d', '#052e16'], ['#7e22ce', '#3b0764'],
  ['#be185d', '#500724'], ['#0f766e', '#042f2e'], ['#b45309', '#451a03'], ['#334155', '#0f172a'],
];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function BookCover({ book, className = '' }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);
  const [a, b] = PALETTES[hash(String(book.id || book.title || '')) % PALETTES.length];
  const showImg = !!book.cover && !failed;

  // image already in the browser cache before React attached onLoad
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete) {
      if (el.naturalWidth > 40) setLoaded(true);
      else if (el.naturalWidth === 0) setFailed(true);
    }
  }, []);

  return (
    <div
      className={`relative aspect-[2/3] rounded-xl overflow-hidden ${className}`}
      style={{ background: `linear-gradient(150deg, ${a}, ${b})` }}
    >
      {!(showImg && loaded) && (
        <div className="absolute inset-0 flex flex-col justify-between p-3 sm:p-4 text-white">
          <div className="w-8 h-0.5 rounded bg-white/50" />
          <div>
            <div className="font-display font-bold leading-tight text-[13px] sm:text-[15px] line-clamp-5">{book.title}</div>
            <div className="mt-2 text-[11px] text-white/70 line-clamp-2">{book.author}</div>
          </div>
        </div>
      )}
      {showImg && (
        <img
          ref={imgRef}
          src={book.cover}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={(e) => (e.currentTarget.naturalWidth > 40 ? setLoaded(true) : setFailed(true))}
          onError={() => setFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {/* spine highlight */}
      <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
    </div>
  );
}
