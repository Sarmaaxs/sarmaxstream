import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";
import { isNative } from "@/lib/native";

const fieldCls =
  "h-12 pl-10 bg-white/5 border-white/15 text-white placeholder:text-white/30 focus-visible:ring-primary";

export default function Login() {
  const [mode, setMode] = useState("password"); // "password" | "link"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const returnTo = safeReturnTo();

  const switchMode = (m) => { setMode(m); setError(""); setLinkSent(false); };

  const handlePassword = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  // Passwordless: Supabase emails a one-tap sign-in link. Existing accounts only.
  const handleLink = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + returnTo },
      });
      if (otpError) throw otpError;
      setLinkSent(true);
    } catch (err) {
      setError(err.message || "Couldn't send the link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + returnTo },
    });
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to Sarmaxstream."
      footer={
        <>
          New here?{" "}
          <Link
            to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="text-primary font-medium hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <div className={isNative ? "hidden" : undefined}>
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 text-sm font-medium bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-3 text-white/40">or</span>
        </div>
      </div>

      </div>

      {/* Password / email-link switch */}
      <div role="tablist" aria-label="Sign-in method" className={"grid grid-cols-2 gap-1 p-1 mb-5 rounded-lg bg-white/5 border border-white/10" + (isNative ? " hidden" : "")}>
        {[["password", "Password"], ["link", "Email link"]].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => switchMode(id)}
            className={`h-9 rounded-md text-sm font-medium transition-colors ${
              mode === id ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {linkSent ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-white">
            <CheckCircle2 className="w-4 h-4 text-primary" /> Check your inbox
          </div>
          <p className="mt-1.5 text-white/60">
            If an account exists for <span className="text-white">{email}</span>, a sign-in link is on its way.
          </p>
          <button type="button" onClick={() => setLinkSent(false)} className="mt-3 text-xs text-primary hover:underline">
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={mode === "password" ? handlePassword : handleLink} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/70">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={fieldCls}
              />
            </div>
          </div>

          {mode === "password" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white/70">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") || false)}
                  onBlur={() => setCapsOn(false)}
                  placeholder="••••••••"
                  required
                  className={fieldCls + " pr-11"}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {capsOn && <p className="text-xs text-amber-300">Caps Lock is on.</p>}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full h-12 text-sm font-semibold mt-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {mode === "password" ? (loading ? "Signing in…" : "Sign in") : loading ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
