import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "../lib/supabase/client";
import AuthLayout from "../components/layout/AuthLayout";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { CircleAlert, CircleCheck } from "lucide-react";

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("checking"); // checking | ready | invalid | done
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (data.user) {
        setStatus("ready");
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && !cancelled) {
        setStatus("ready");
      }
    });

    // The session is created from the token in the email link — that happens
    // asynchronously on page load, so poll briefly before giving up.
    check();
    const poll = setInterval(check, 500);
    const timeout = setTimeout(() => {
      if (!cancelled) {
        clearInterval(poll);
        setStatus((s) => (s === "checking" ? "invalid" : s));
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function resetPassword(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage("Password updated. Redirecting to sign in…");
    setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <h1 className="text-lg font-semibold text-ink-primary">Reset password</h1>
      </div>

      {status === "checking" && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-5 py-8 text-center">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-subtle">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
          </div>
          <p className="text-sm text-ink-tertiary">Checking your link…</p>
        </div>
      )}

      {status === "invalid" && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-5 py-6 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-danger-subtle text-danger-subtle-fg">
            <CircleAlert size={18} strokeWidth={1.75} />
          </span>
          <p className="text-sm font-medium text-ink-primary">This link is invalid or expired</p>
          <p className="text-xs text-ink-tertiary">Request a new link to reset your password.</p>
          <Link href="/forgot-password" className="mt-1 w-full">
            <Button className="w-full">Request a new link</Button>
          </Link>
        </div>
      )}

      {status === "ready" && (
        <form onSubmit={resetPassword} className="flex flex-col gap-3">
          <Input
            type="password"
            required
            minLength={6}
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoFocus
          />
          <Input
            type="password"
            required
            minLength={6}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {message && (
            <p className="flex items-center gap-1.5 text-sm text-success">
              <CircleCheck size={14} />
              {message}
            </p>
          )}
          {error && (
            <p className="flex items-center gap-1.5 text-sm text-danger">
              <CircleAlert size={14} />
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Set new password
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
