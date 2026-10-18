// src/components/AnimatedButton.jsx — NEW FILE
//
// Drop-in replacement for a plain <button>. Gives every button a
// consistent press/hover/glow feel without touching each component's
// existing styling — pass your existing className through, this just
// layers the animation classes on top.
//
// USAGE — anywhere you currently have:
//   <button className="..." onClick={...}>Play</button>
// swap the tag only:
//   <AnimatedButton className="..." onClick={...}>Play</AnimatedButton>
//
// For icon-only circular buttons (play/pause overlays, heart icons, etc.)
// pass variant="icon" for a tighter glow radius.

import React from 'react';

export default function AnimatedButton({
  as: Tag = 'button',
  variant = 'default', // 'default' | 'icon' | 'primary'
  className = '',
  children,
  ...props
}) {
  return (
    <Tag className={`anim-btn anim-btn-${variant} ${className}`} {...props}>
      <span className="anim-btn-inner">{children}</span>
    </Tag>
  );
}

// One-time global CSS — paste this block into src/index.css (anywhere
// inside an existing @layer components block, or at the end of the file).
// Not injected via <style> here on purpose: buttons render constantly
// (every track card, every row), so this belongs in the compiled
// stylesheet, not re-parsed inline per component.
export const ANIMATED_BUTTON_CSS = `
.anim-btn {
  position: relative;
  transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, background 0.2s ease;
  transform: translateZ(0);
}
.anim-btn:hover {
  transform: translateY(-1px) scale(1.015);
}
.anim-btn:active {
  transform: translateY(0) scale(0.96);
  transition-duration: 0.08s;
}
.anim-btn-inner {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.anim-btn-primary:hover {
  box-shadow: 0 0 0 1px hsl(var(--primary) / 0.5), 0 8px 24px -8px hsl(var(--primary) / 0.55);
}

.anim-btn-icon {
  border-radius: 9999px;
}
.anim-btn-icon:hover {
  box-shadow: 0 0 0 6px hsl(var(--primary) / 0.12);
}
.anim-btn-icon:active {
  transform: scale(0.88);
}

@media (prefers-reduced-motion: reduce) {
  .anim-btn, .anim-btn:hover, .anim-btn:active {
    transition: none !important;
    transform: none !important;
  }
}
`;
