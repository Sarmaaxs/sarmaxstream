import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { runBackHandler } from "@/lib/backStack";

// The Android app asks the page what Back should do (see mobile/MainActivity.java):
//   1) close whatever is on top (video player, full-screen player, menu)
//   2) go to the previous page
//   3) from a deep page with no history (e.g. after reopening the app) go Home
//   4) on Home: send the app to the background, never close it
export default function NativeBackButton() {
  const navigate = useNavigate();
  const loc = useLocation();
  const pathRef = useRef(loc.pathname);
  pathRef.current = loc.pathname;

  useEffect(() => {
    window.__sxBack = () => {
      if (runBackHandler()) return "handled";
      const idx = window.history.state && window.history.state.idx;
      if (typeof idx === "number" && idx > 0) { navigate(-1); return "handled"; }
      if (pathRef.current !== "/") { navigate("/", { replace: true }); return "handled"; }
      return "minimize";
    };
    return () => { delete window.__sxBack; };
  }, [navigate]);
  return null;
}
