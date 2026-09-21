import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import BackButton from "@/components/BackButton";
import { animeFindMalId } from "@/lib/anime";

// Opened when someone clicks an anime that came from TMDB (search, home rows, anime page).
// Finds the MyAnimeList id, then replaces itself with /title/anime/:malId (the sub/dub player page).
export default function AnimeResolve({ kind = "tv" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    animeFindMalId(kind, id)
      .then((malId) => {
        if (active) navigate(`/title/anime/${malId}`, { replace: true });
      })
      .catch((e) => {
        if (active) setError(e.message || "Couldn't load this anime.");
      });
    return () => {
      active = false;
    };
  }, [kind, id, attempt, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />
      <div className="pt-[calc(8rem+env(safe-area-inset-top,0px))] px-6 text-center text-muted-foreground">
        {!error ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm">Loading anime…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p>{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setAttempt((n) => n + 1)}
                className="h-10 px-5 rounded-full bg-white/10 border border-white/15 text-sm text-foreground hover:bg-white/15 transition"
              >
                Try again
              </button>
              <Link
                to={`/title/${kind}/${id}`}
                className="h-10 px-5 inline-flex items-center rounded-full bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition"
              >
                Watch with standard player
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
