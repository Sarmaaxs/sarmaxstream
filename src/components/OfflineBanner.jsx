import React, { useEffect, useState } from "react";

// Small notice when the connection drops, so it is clear why some things are missing.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    const off = () => setOffline(true);
    const on = () => setOffline(false);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="fixed inset-x-0 z-[70] flex justify-center pointer-events-none" style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}>
      <div className="px-4 py-1.5 rounded-full bg-amber-400 text-black text-xs font-semibold shadow-lg">You're offline. Showing saved content.</div>
    </div>
  );
}
