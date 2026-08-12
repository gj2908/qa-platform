import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { useCurrentUser } from "../../lib/useCurrentUser";
import OtpCodeInput from "../ui/OtpCodeInput";
import Button from "../ui/Button";
import { ShieldCheck, LogOut } from "lucide-react";

// One-time reverification for accounts that existed before email
// verification was added — their email_confirmed_at is already set (they
// were auto-confirmed under the old config), so unlike VerifyEmailGate this
// can't rely on the session/JWT alone and needs its own DB read of
// profiles.needs_reverification. z-[95], above both CompleteProfileGate
// (z-[80]) and VerifyEmailGate (z-[90]) — in practice they never overlap
// for the same user, but this is a security gate so it wins ties.
export default function ReverificationGate() {
  const user = useCurrentUser();
  const [needsReverification, setNeedsReverification] = useState(null); // null = not checked yet
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("needs_reverification")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) setNeedsReverification(!!data?.needs_reverification);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user || !needsReverification || dismissed) return null;

  async function sendCode() {
    setSending(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
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
    setDismissed(true);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-4 pb-10 pt-8 sm:items-center sm:pt-4">
      <div className="absolute inset-0 bg-neutral-950/50" aria-hidden="true" />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg">
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

          <button
            onClick={signOut}
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-ink-tertiary hover:text-ink-secondary"
          >
            <LogOut size={12} strokeWidth={2.25} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
