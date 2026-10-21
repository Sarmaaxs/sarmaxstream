import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { isNative } from "@/lib/native";
import { getConsent } from "@/components/CookieBanner";

// "Install app" card for the website (Chrome / Edge / Android). Not shown inside the Android app,
// when already installed, or while the cookie notice is still open.
const KEY = "sx:install-dismissed";

export default function InstallPrompt() {
  const [evt, setEvt] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isNative) return undefined;
    const standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    if (standalone) return undefined;
    let dismissed = 0;
    try { dismissed = Number(localStorage.getItem(KEY) || 0); } catch { /* ignore */ }
    if (Date.now() - dismissed < 30 * 24 * 3600 * 1000) return undefined;
    const onPrompt = (e) => {
      e.preventDefault();
      setEvt(e);
      setTimeout(() => { if (getConsent()) setShow(true); }, 20000); // not right away
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show || !evt) return null;
  const close = () => { setShow(false); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } };
  const install = async () => { try { await evt.prompt(); } catch { /* ignore */ } close(); };
  return (
    <div className="fixed z-[55] left-3 right-3 sm:left-4 sm:right-auto sm:max-w-sm bottom-[calc(var(--bottom-nav-h,3.5rem)+env(safe-area-inset-bottom,0px)+0.5rem)] md:bottom-4 rounded-2xl border border-white/15 bg-card/95 backdrop-blur p-4 shadow-2xl flex items-center gap-3">
      <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/15 text-primary flex items-center justify-center"><Download size={20} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">Install Sarmaxstream</div>
        <div className="text-xs text-white/55">Opens like an app and works offline.</div>
      </div>
      <button onClick={install} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold">Install</button>
      <button onClick={close} aria-label="Not now" className="p-1.5 text-white/50 hover:text-white"><X size={16} /></button>
    </div>
  );
}
