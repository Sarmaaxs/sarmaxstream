import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bookmark, LogIn, UserRound } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import SearchBox from "@/components/SearchBox";

export default function Navbar() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, [location.pathname]);

  const links = [
  { label: "Home", to: "/" },
  { label: "Movies", to: "/search?genre=movie" },
  { label: "TV Shows", to: "/search?genre=tv" },
  { label: "Anime", to: "/anime" },
  { label: "Music", to: "/music" }];


  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 pt-safe transition-all duration-300 ${
      scrolled ? "glass border-b border-border/60" : "bg-gradient-to-b from-black/80 to-transparent"}`
      }>
      
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 h-16 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          
          <span className="font-display font-bold text-lg tracking-tight">
            sarmax<span className="text-primary">stream</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          {links.map((l) =>
          <Link key={l.to} to={l.to} className="hover:text-foreground transition-colors">
              {l.label}
            </Link>
          )}
        </nav>

        <div className="hidden sm:block flex-1 max-w-md ml-auto">
          <SearchBox size="nav" />
        </div>

        <div className="flex items-center gap-2 ml-auto sm:ml-2">
          {authed ?
          <>
            <Link
              to="/watchlist"
              className="hidden md:flex items-center gap-2 h-10 px-3 rounded-full bg-white/5 border border-border/60 text-sm hover:bg-white/10 transition-colors">
              
              <Bookmark className="w-4 h-4 text-primary" />
              <span>My List</span>
            </Link>
            <Link
              to="/watchlist#account"
              aria-label="Account"
              className="flex items-center justify-center h-10 w-10 rounded-full bg-white/5 border border-border/60 hover:bg-white/10 transition-colors">
              
              <UserRound className="w-4 h-4" />
            </Link>
          </> :

          <Link
            to="/login"
            className="flex items-center gap-2 h-10 px-3 rounded-full bg-white/5 border border-border/60 text-sm hover:bg-white/10 transition-colors">
            
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          }
        </div>
      </div>
    </header>);

}
