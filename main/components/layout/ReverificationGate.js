import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "../../lib/supabase/client";
import { useCurrentUser } from "../../lib/useCurrentUser";
import OtpCodeInput from "../ui/OtpCodeInput";
import Button from "../ui/Button";
import { ShieldCheck, LoaderCircle } from "lucide-react";

// Module-level (not React state) so the answer survives this gate
// unmounting/remounting on every page navigation — ProjectShell/AppShell
// aren't persistent layouts in the Pages Router, they're rendered fresh
// per page, so without this cache the DB check (and its blocking loading
// state) re-ran and re-flashed on every single navigation, even after the
// user had already verified this session. A real browser refresh clears
// this (it's just a JS variable), so the refresh-can't-escape-the-gate
// fix stays intact — only same-session client-side navigations skip the
// re-check. Keyed by user id in case of a sign-out/sign-in as someone else
// without a full page reload.
let verifiedThisSession = null; // { userId, needsReverification }

// One-time reverification for accounts that existed before email
// verification was added — their email_confirmed_at is already set (they
// were auto-confirmed under the old config), so unlike VerifyEmailGate this
// can't rely on the session/JWT alone and needs its own DB read of
// profiles.needs_reverification. z-[95], above both CompleteProfileGate
// (z-[80]) and VerifyEmailGate (z-[90]) — in practice they never overlap
// for the same user, but this is a security gate so it wins ties.
export default function ReverificationGate() {
  const user = useCurrentUser();
  // null = not checked yet. Rendered as a blocking loading state (not
  // `return null`) while unknown, so a page refresh can never show a flash
  // of real content before the DB check resolves — the other two gates get
  // their answer synchronously from the already-available user object — this
  // one needs an extra network round-trip, so it's the one actually at risk
  // of that gap. Seeded from the module-level cache when it already has an
  // answer for this user, so repeat navigations skip both the round-trip
  // and the loading flash entirely.
  const [needsReverification, setNeedsReverification] = useState(
    user && verifiedThisSession?.userId === user.id ? verifiedThisSession.needsReverification : null
  );
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    if (verifiedThisSession?.userId === user.id) {
      setNeedsReverification(verifiedThisSession.needsReverification);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("needs_reverification")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        const result = !!data?.needs_reverification;
        verifiedThisSession = { userId: user.id, needsReverification: result };
        if (!cancelled) setNeedsReverification(result);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) return null;
  if (needsReverification === false) return null;

  async function sendCode() {
    setSending(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setSending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  async function verifyCode(code) {
    setVerifying(true);
    setError("");
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: user.email,
      token: code,
      type: "email",
    });
    if (verifyError) {
      setVerifying(false);
      setError(verifyError.message);
      return;
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ needs_reverification: false, reverified_at: new Date().toISOString() })
      .eq("id", user.id);
    setVerifying(false);
    if (profileError) {
      setError(profileError.message);
      return;
    }
    verifiedThisSession = { userId: user.id, needsReverification: false };
    setNeedsReverification(false);
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-4 pb-10 pt-8 sm:items-center sm:pt-4">
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
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg"
      >
        {needsReverification === null ? (
          <div className="flex items-center justify-center px-5 py-10">
            <LoaderCircle size={20} className="animate-spin text-ink-tertiary" />
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-fg">
                <ShieldCheck size={14} strokeWidth={2.25} />
              </span>
              <h2 className="text-sm font-semibold text-ink-primary">Verify your email to continue</h2>
            </div>

            <div className="flex flex-col gap-4 px-5 py-5">
              <p className="text-sm text-ink-tertiary">
                For your account's security, we need to confirm{" "}
                <span className="font-medium text-ink-secondary">{user.email}</span> is still yours. This is a
                one-time check.
              </p>

              {!sent ? (
                <>
                  {error && <p className="text-sm text-danger">{error}</p>}
                  <Button onClick={sendCode} loading={sending}>
                    Send verification code
                  </Button>
                </>
              ) : (
                <OtpCodeInput
                  email={user.email}
                  onSubmit={verifyCode}
                  submitting={verifying}
                  onResend={sendCode}
                  resending={sending}
                  error={error}
                  sentLabel={`We sent a code to ${user.email}.`}
                />
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
