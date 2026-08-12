import { useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "../../lib/supabase/client";
import { useCurrentUser } from "../../lib/useCurrentUser";
import Button from "../ui/Button";
import { MailCheck, LogOut } from "lucide-react";

// Blocks the app (no close/cancel/backdrop-dismiss, same as
// CompleteProfileGate) until the signed-in user's email is confirmed.
// This is the defense-in-depth layer: if Supabase's "Confirm email"
// project setting is on, login.js's sign-in error path already catches
// this before a session even exists — this gate instead covers a
// session that was established before verifying (e.g. "Confirm email"
// was off, or the account predates this feature).
export default function VerifyEmailGate() {
  const user = useCurrentUser();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  const needsVerification = !!user && !user.email_confirmed_at && !dismissed;
  if (!needsVerification) return null;

  async function resend() {
    setResending(true);
    setResent(false);
    const supabase = createClient();
    await supabase.auth.resend({ type: "signup", email: user.email });
    setResending(false);
    setResent(true);
  }

  async function recheck() {
    setChecking(true);
    setCheckError("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    setChecking(false);
    if (error) {
      setCheckError(error.message);
      return;
    }
    if (data.user?.email_confirmed_at) {
      setDismissed(true);
    } else {
      setCheckError("Still not verified — check your inbox for the link.");
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 pb-10 pt-8 sm:items-center sm:pt-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12 }}
        className="absolute inset-0 bg-neutral-950/50"
        aria-hidden="true"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-fg">
            <MailCheck size={14} strokeWidth={2.25} />
          </span>
          <h2 className="text-sm font-semibold text-ink-primary">Verify your email to continue</h2>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <p className="text-sm text-ink-tertiary">
            We sent a confirmation link to <span className="font-medium text-ink-secondary">{user.email}</span>.
            Click it, then come back here.
          </p>

          {checkError && <p className="text-sm text-danger">{checkError}</p>}

          <div className="flex flex-col gap-2">
            <Button onClick={recheck} loading={checking}>
              I've verified — continue
            </Button>
            <Button variant="secondary" onClick={resend} loading={resending} disabled={resent}>
              {resent ? "Email sent" : "Resend verification email"}
            </Button>
          </div>

          <button
            onClick={signOut}
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-ink-tertiary hover:text-ink-secondary"
          >
            <LogOut size={12} strokeWidth={2.25} />
            Sign out
          </button>
        </div>
      </motion.div>
    </div>
  );
}
