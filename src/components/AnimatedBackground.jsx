// src/components/AnimatedBackground.jsx — NEW FILE
//
// Ambient animated background: slow-drifting blurred color orbs +
// a small idle equalizer flourish that speeds up while a track is playing.
// Pure CSS animation (no canvas, no extra deps) so it stays light even on
// low-end hardware. Uses your existing CSS custom properties
// (--primary, --background, --border) so it automatically matches your
// current theme — change the theme tokens in index.css and this follows.
//
// USAGE: mount it once, near the top of your app shell (e.g. Layout.jsx),
// as a fixed, non-interactive layer behind everything else:
//
//   import AnimatedBackground from '@/components/AnimatedBackground';
//   ...
//   <AnimatedBackground playing={player?.isPlaying} />
//   <div className="relative z-10"> ...rest of your app... </div>
//
// The `playing` prop is optional — omit it and the background just runs
// its slow idle animation. Pass `player.isPlaying` from PlayerContext to
// have the equalizer bars pick up pace when a track is actually playing.

import React from 'react';

export default function AnimatedBackground({ playing = false }) {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
    >
      {/* Base wash so orbs blend into the existing dark background */}
      <div className="absolute inset-0" style={{ background: 'hsl(var(--background))' }} />

      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />

      {/* Subtle grain/vignette so the orbs don't look too flat/plasticky */}
      <div className="absolute inset-0 vignette" />

      {/* Small equalizer flourish, bottom-right — purely decorative */}
      <div className={`eq ${playing ? 'eq-active' : 'eq-idle'}`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>

      <style>{`
        .orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(70px);
          opacity: 0.35;
          will-change: transform;
        }
        .orb-a {
          width: 42vw;
          height: 42vw;
          max-width: 620px;
          max-height: 620px;
          top: -10%;
          left: -8%;
          background: radial-gradient(circle at 30% 30%, hsl(var(--primary) / 0.55), transparent 70%);
          animation: drift-a 26s ease-in-out infinite;
        }
        .orb-b {
          width: 36vw;
          height: 36vw;
          max-width: 520px;
          max-height: 520px;
          top: 30%;
          right: -10%;
          background: radial-gradient(circle at 60% 40%, hsl(280 70% 60% / 0.45), transparent 70%);
          animation: drift-b 32s ease-in-out infinite;
        }
        .orb-c {
          width: 30vw;
          height: 30vw;
          max-width: 460px;
          max-height: 460px;
          bottom: -12%;
          left: 20%;
          background: radial-gradient(circle at 40% 60%, hsl(190 80% 55% / 0.40), transparent 70%);
          animation: drift-c 38s ease-in-out infinite;
        }

        @keyframes drift-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(6vw, 8vh) scale(1.12); }
        }
        @keyframes drift-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-7vw, 5vh) scale(1.08); }
        }
        @keyframes drift-c {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(4vw, -6vh) scale(1.15); }
        }

        .vignette {
          background: radial-gradient(120% 100% at 50% 0%, transparent 55%, hsl(var(--background) / 0.55) 100%);
        }

        .eq {
          position: absolute;
          bottom: 22px;
          right: 22px;
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 22px;
          opacity: 0.35;
        }
        .eq span {
          width: 3px;
          border-radius: 2px;
          background: hsl(var(--primary));
          height: 6px;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        .eq-idle span {
          animation-name: eq-idle;
          animation-duration: 2.4s;
        }
        .eq-active span {
          animation-name: eq-active;
          animation-duration: 0.9s;
          opacity: 0.7;
        }
        @keyframes eq-idle {
          0%, 100% { height: 4px; }
          50%      { height: 10px; }
        }
        @keyframes eq-active {
          0%, 100% { height: 5px; }
          50%      { height: 20px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .orb, .eq span { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
