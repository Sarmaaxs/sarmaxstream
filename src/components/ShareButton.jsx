import React from "react";
import { Share2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Android app: the system share sheet. Browsers: the Web Share dialog, or copy the link.
export default function ShareButton({ title, text, className = "" }) {
  const share = async () => {
    const url = window.location.href;
    const message = [text || title, url].filter(Boolean).join("\n");
    try {
      if (window.SxNative && window.SxNative.share) { window.SxNative.share(message); return; }
      if (navigator.share) { await navigator.share({ title, text: text || title, url }); return; }
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    } catch { /* cancelled */ }
  };
  return (
    <button
      onClick={share}
      aria-label="Share"
      className={`h-12 px-5 rounded-full bg-white/10 border border-white/15 hover:bg-white/15 transition flex items-center gap-2 text-sm font-medium ${className}`}
    >
      <Share2 size={18} /> Share
    </button>
  );
}
