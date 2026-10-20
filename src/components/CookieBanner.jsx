import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCookie, setCookie } from "@/lib/cookies";
import { isNative } from "@/lib/native";

// One-time notice. The choice is stored in a cookie (sx_consent = all | essential) for a year.
export const getConsent = () => getCookie("sx_consent");

export default function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => { if (!isNative && !getCookie("sx_consent")) setShow(true); }, []);
  if (!show) return null;
  const choose = (v) => { setCookie("sx_consent", v, 365); setShow(false); };
  return (
    <div role="dialog" aria-label="Cookies" className="fixed z-[60] left-3 right-3 sm:left-auto sm:right-4 sm:max-w-sm bottom-[calc(var(--bottom-nav-h,3.5rem)+env(safe-area-inset-bottom,0px)+0.5rem)] md:bottom-4 rounded-2xl border border-white/15 bg-card/95 backdrop-blur p-4 shadow-2xl">
      <p className="text-sm text-white/80 leading-snug">
        We use cookies and local storage to keep you signed in, remember where you stopped, and make the site work offline.{" "}
        <Link to="/privacy" className="text-primary hover:underline">Learn more</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => choose("all")} className="flex-1 h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold">Accept</button>
        <button onClick={() => choose("essential")} className="flex-1 h-10 rounded-full bg-white/10 border border-white/15 text-sm">Essential only</button>
      </div>
    </div>
  );
}
