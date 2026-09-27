import React, { useEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PlayerBar from '@/components/PlayerBar';
import { usePlayer } from '@/lib/PlayerContext';
import DogMascot from '@/components/DogMascot';
import AnimatedBackground from '@/components/AnimatedBackground';

export default function MusicLayout() {
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
      thumbnail: 'https://i.ytimg.com/vi/' + v + '/mqdefault.jpg',
    };
    player.playTrack(track, [track]);
  }, [params, player.isReady]);

  return (
    <div className="min-h-screen bg-background relative">
      <AnimatedBackground playing={player && player.isPlaying} />
      <Navbar />
      <div className="pt-nav pb-page mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 relative z-10">
        <Outlet />
      </div>
      <Footer />
      <PlayerBar />
      <DogMascot />
    </div>
  );
}
