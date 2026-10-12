import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';

export default function ShareButton({ track, className = '', title = 'Copy link' }) {
  const [copied, setCopied] = useState(false);

  const buildUrl = () => {
    const base = window.location.origin;
    const p = new URLSearchParams();
    p.set('v', track.videoId);
    if (track.title) p.set('t', track.title);
    if (track.artist) p.set('a', track.artist);
    return `${base}/?${p.toString()}`;
  };

  const share = async (e) => {
    e.stopPropagation();
    const url = buildUrl();
    try {
      if (navigator.share) {
        await navigator.share({ title: track.title || 'Sarmax Stream', url });
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button onClick={share} className={`p-1.5 rounded-lg hover:bg-white/5 ${copied ? 'text-primary' : 'text-white/40 hover:text-white'} ${className}`} title={title}>
      {copied ? <Check size={17} /> : <Share2 size={17} />}
    </button>
  );
}
