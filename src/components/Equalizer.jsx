import React from 'react';
// Tiny animated equalizer bars. They dance while a song plays and rest when paused.
export default function Equalizer({ playing = false, className = '' }) {
  return (
    <span className={`eq ${playing ? 'eq-on' : ''} ${className}`} aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}
