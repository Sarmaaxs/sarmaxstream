import React, { useState } from "react";
import { LogOut, Trash2, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { deleteMyAccount } from "@/lib/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CONFIRM_WORD = "DELETE";

function displayName(user) {
  return user?.full_name?.trim() || user?.email?.split("@")[0] || "Your account";
}

function initials(user) {
  const src = displayName(user);
  const parts = src.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : src.slice(0, 2);
  return letters.toUpperCase();
}

function memberSince(user) {
  const d = user?.created_date ? new Date(user.created_date) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-3.5">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-right min-w-0 truncate">{children}</dd>
    </div>
  );
}

/**
 * Profile + account controls. Shown on the (signed-in only) My List page.
 * Includes the in-app account deletion flow that app stores require.
 */
export default function AccountDashboard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD && !deleting;

  const signOut = () => supabase.auth.signOut().then(() => window.location.assign("/"));

  const onOpenChange = (next) => {
    if (deleting) return; // don't let the dialog close mid-request
    setOpen(next);
    if (!next) {
      setConfirmText("");
      setError("");
    }
  };

  const confirmDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError("");
    try {
      await deleteMyAccount();
      // Account is gone server-side; clear the local session and leave.
      await supabase.auth.signOut();
      window.location.assign("/");
    } catch (err) {
      setError(err.message || "Couldn't delete your account. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <section id="account" className="mt-14 scroll-mt-28">
      <h2 className="font-display font-bold text-xl mb-4">Account</h2>

      <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
        <div className="p-5 sm:p-6 flex items-center gap-4">
          <div
            aria-hidden="true"
            className="shrink-0 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-lg"
          >
            {initials(user)}
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-lg truncate">{displayName(user)}</div>
            <div className="text-sm text-muted-foreground truncate">{user?.email}</div>
          </div>
        </div>

        <dl className="border-t border-border/60 divide-y divide-border/60 text-sm">
          <Row label="Sign-in email">{user?.email || "—"}</Row>
          <Row label="Name">{user?.full_name || "Not set"}</Row>
          <Row label="Email status">
            {user?.is_verified ? (
              <span className="inline-flex items-center gap-1.5 text-primary">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <ShieldAlert className="w-4 h-4" aria-hidden="true" /> Not verified
              </span>
            )}
          </Row>
          <Row label="Member since">{memberSince(user)}</Row>
        </dl>

        <div className="border-t border-border/60 p-5 sm:p-6">
          <Button variant="outline" onClick={signOut} className="h-11 rounded-full px-6 w-full sm:w-auto">
            <LogOut aria-hidden="true" /> Sign out
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-medium">Delete account</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Permanently delete your account along with your watchlist and viewing progress. This can't be undone.
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={() => setOpen(true)}
          className="h-11 rounded-full px-6 w-full sm:w-auto shrink-0"
        >
          <Trash2 aria-hidden="true" /> Delete account
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <span className="text-foreground font-medium">{user?.email}</span>, your saved
              titles and your continue-watching history. You won't be able to recover them.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              Type <span className="font-mono text-foreground">{CONFIRM_WORD}</span> to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={deleting}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder={CONFIRM_WORD}
              className="h-11"
            />
            {error && (
              <div role="alert" className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting} className="h-11 sm:h-10">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={!canDelete} className="h-11 sm:h-10">
              {deleting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
