import { useEffect, useRef } from 'react';

// Desktop shortcuts for the music player:
//   Space = play/pause   ← / → = seek 5s   Shift+← / Shift+→ = previous / next
//   M = mute             L = like           ↑ / ↓ = volume
// Ignored while you're typing in a field or focused on a button/link.
export function useKeyboardShortcuts(player, onLike) {
  const ref = useRef({ player, onLike });
  ref.current = { player, onLike };

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      const tag = el && el.tagName;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag))) return;
      const { player: p, onLike: like } = ref.current;
      if (!p || !p.current) return;
      switch (e.key) {
        case ' ': e.preventDefault(); p.togglePlay(); break;
        case 'ArrowRight': e.preventDefault(); e.shiftKey ? p.next() : p.seek(Math.min(p.duration || 0, p.currentTime + 5)); break;
        case 'ArrowLeft': e.preventDefault(); e.shiftKey ? p.prev() : p.seek(Math.max(0, p.currentTime - 5)); break;
        case 'ArrowUp': e.preventDefault(); p.setVolume(Math.min(100, (p.volume || 0) + 5)); break;
        case 'ArrowDown': e.preventDefault(); p.setVolume(Math.max(0, (p.volume || 0) - 5)); break;
        case 'm': case 'M': p.toggleMute(); break;
        case 'l': case 'L': if (like) like(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
