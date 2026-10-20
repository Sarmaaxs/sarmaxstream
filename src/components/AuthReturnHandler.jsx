import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { takeReturnTo } from "@/lib/authReturnTo";

// After Google / email-link sign-in the browser lands on the site root.
// This moves the person to the page they were on before signing in.
export default function AuthReturnHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN") return;
      const path = takeReturnTo();
      if (path && path !== "/" && window.location.pathname === "/") navigate(path, { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);
  return null;
}
