import React from "react";
import { Link, useLocation } from "react-router-dom";

// Same full-screen flows where the bottom tab bar is hidden.
const HIDDEN_ON = ["/login", "/register", "/forgot-password", "/reset-password"];

const LINKS = [
  { label: "Terms of Service", to: "/terms" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "FAQs", to: "/faq" },
  { label: "Contact", to: "/contact" },
];

export default function Footer() {
  const { pathname } = useLocation();
  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <footer className="border-t border-border/60 mt-12">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pt-8 pb-24 md:pb-10 space-y-4 text-muted-foreground">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs">© {new Date().getFullYear()} sarmaxstream. All rights reserved.</p>
      </div>
    </footer>
  );
}
