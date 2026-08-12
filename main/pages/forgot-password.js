import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "../lib/supabase/client";
import AuthLayout from "../components/layout/AuthLayout";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import OtpCodeInput from "../components/ui/OtpCodeInput";
import { CircleAlert, MailCheck } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState("");
  const router = useRouter();

  async function sendResetLink(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/reset-password`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  async function verifyResetCode(code) {
    setOtpSubmitting(true);
    setOtpError("");
    const supabase = createClient();
    // The code came from signInWithOtp above, so it verifies as type
    // "email" — a successful verify establishes a session directly
    // (same end state as clicking the emailed link), so reset-password's
    // existing session-polling picks it up immediately with no further
    // token handling needed here.
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setOtpSubmitting(false);
    if (error) {
      setOtpError(error.message);
      return;
    }
    router.push("/reset-password");
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <h1 className="text-lg font-semibold text-ink-primary">Reset password</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          {sent ? "Check your inbox for next steps" : "We'll email you a link to reset it"}
        </p>
      </div>

      {sent ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-5 py-6 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-success-subtle text-success-subtle-fg">
            <MailCheck size={18} strokeWidth={1.75} />
          </span>
          <p className="text-sm text-ink-secondary">
            Check your email for a link to reset your password.
          </p>
          {error && (
            <p className="flex items-center gap-1.5 text-sm text-danger">
              <CircleAlert size={14} />
              {error}
            </p>
          )}
          <div className="w-full text-left">
            <OtpCodeInput
              email={email}
              onSubmit={verifyResetCode}
              submitting={otpSubmitting}
              onResend={sendResetLink}
              resending={loading}
              error={otpError}
            />
          </div>
          <p className="text-xs text-ink-tertiary">
            No email? Double-check the address or{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setSent(false);
              }}
              className="font-medium text-accent hover:text-accent-hover"
            >
              try again
            </a>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={sendResetLink} className="flex flex-col gap-3">
          <Input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-danger">
              <CircleAlert size={14} />
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Send reset link
          </Button>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-ink-tertiary">
        Remembered your password?{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
