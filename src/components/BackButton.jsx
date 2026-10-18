import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

/**
 * Floating "Back" chevron for child/detail screens. Sits just below the fixed
 * navbar (clearing the top safe-area inset) and floats over the page content.
 *
 * Goes back in history when this session has somewhere to go back to;
 * otherwise (deep link, fresh WebView launch) falls back to `fallback` so the
 * button never strands the user on a screen with no way out.
 */
export default function BackButton({ fallback = "/", className = "" }) {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = () => {
    // react-router gives the first entry of a session the key "default".
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Back"
      className={`fixed z-40 left-4 sm:left-6 lg:left-10 top-[calc(env(safe-area-inset-top,0px)+4.75rem)] h-11 w-11 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/15 text-foreground shadow-lg hover:bg-black/70 active:scale-95 transition ${className}`}
    >
      <ChevronLeft className="w-6 h-6 -ml-0.5" aria-hidden="true" />
    </button>
  );
}
