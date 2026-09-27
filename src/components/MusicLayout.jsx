import React, { useEffect } from 'react';
import { Outlet, Link, useLocation, useSearchParams } from 'react-router-dom';
import PlayerBar from '@/components/PlayerBar';
import { usePlayer } from '@/lib/PlayerContext';
import DogMascot from '@/components/DogMascot';
import AnimatedBackground from '@/components/AnimatedBackground';
import { useAuth } from '@/lib/AuthContext';
import { Music4, Library, Settings as SettingsIcon, LogIn, LogOut } from 'lucide-react';

// NOTE: DogMascot.jsx still points at a media.base44.com-hosted image.
// That's fine while your Base44 project stays active, but since you're
// moving off Base44 entirely, that image could disappear without warning
// down the line. Worth downloading it and hosting it yourself
// (e.g. in /public/dog-mascot.png) and pointing DogMascot.jsx at that
// local path instead, whenever you get a moment.

export default function MusicLayout() {
  const { isAuthenticated, logout } = useAuth();
  const loc = useLocation();
  const player = usePlayer();
  const [params] = useSearchParams();

  useEffect(() => {
    const v = params.get('v');
    if (!v || !player.isReady) return;
    if (player.current && player.current.videoId === v) return;
    const track = {
      videoId: v,
      title: params.get('t') || '',
      artist: params.get('a') || '',
      thumbnail: `https://i.ytimg.com/vi/${v}/mqdefault.jpg`
    };
    player.playTrack(track, [track]);
  }, [params, player.isReady]);

  const navLink = (to, label, Icon) => {
    const active = loc.pathname === to;
    return (
      <Link to={to} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm glass-hover ${active ? 'text-primary' : 'text-white/70'}`}>
        <Icon size={18} />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen pb-32 relative">
      <AnimatedBackground playing={player?.isPlaying} />
      <header className="sticky top-0 z-40 glass-strong border-b border-white/10">
          <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 py-3">
            <Link to="/music" className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight"><span className="text-white">sarmax</span><span className="text-primary">music</span></span>
            </Link>
            <nav className="flex items-center gap-1 ml-2">
              {navLink('/music', 'Home', Music4)}
              {navLink('/music/library', 'Library', Library)}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Link to="/music/settings" className={`flex items-center justify-center w-9 h-9 rounded-xl glass glass-hover ${loc.pathname === '/music/settings' ? 'text-primary' : 'text-white/70'}`} aria-label="Settings">
                <SettingsIcon size={18} />
              </Link>
              {isAuthenticated ?
                <button onClick={() => logout()} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm glass glass-hover text-white/80">
                  <LogOut size={16} /><span className="hidden sm:inline">Log out</span>
                </button> :
                <Link to="/login" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium glass-hover">
                  <LogIn size={16} /><span className="hidden sm:inline">Log in</span>
                </Link>
              }
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6 relative z-10">
          <Outlet />
        </main>
      <PlayerBar />
      <DogMascot />
    </div>
  );
}
