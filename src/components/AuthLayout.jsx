import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 pt-safe pb-safe">
      {/* Animated aurora background */}
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="auth-aurora" aria-hidden="true">
        <div className="auth-blob b1" />
        <div className="auth-blob b2" />
        <div className="auth-blob b3" />
        <div className="auth-grid" />
      </div>

      <div className="relative w-full max-w-md z-10">
        <div className="auth-head text-center mb-8">
          <div className="auth-icon inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 mb-5 shadow-lg shadow-primary/20">
            <Icon className="w-7 h-7 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="text-white/50 mt-2 text-[15px]">{subtitle}</p>}
        </div>

        {/* glowing border beam + card */}
        <div className="auth-glow">
          <div className="auth-card">{children}</div>
        </div>

        {footer && (
          <p className="auth-enter text-center text-sm text-white/40 mt-6" style={{ animationDelay: ".9s" }}>{footer}</p>
        )}
      </div>
    </div>
  );
}
