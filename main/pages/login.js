import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "../lib/supabase/client";
import AuthLayout from "../components/layout/AuthLayout";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { CircleAlert, CircleCheck } from "lucide-react";

export default function Login() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
  const [resending, setResending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setUnconfirmedEmail("");
    setLoading(true);
    const supabase = createClient();
    const redirectTo = router.query.redirectTo || "/dashboard";

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setLoading(false);
        setError(error.message);
        // Supabase intentionally returns the same generic "Invalid login
        // credentials" for a wrong password AND an unconfirmed account
        // (avoids leaking confirmation status) — there's no way to tell
        // which one this is from the error alone, so a failed sign-in
        // always offers a resend rather than trying to guess.
        setUnconfirmedEmail(email);
        return;
      }
      router.push(redirectTo);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}${redirectTo}`,
        },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setMessage("Check your email to verify your account, then sign in.");
      setMode("signin");
    }
  }

  async function resendVerification() {
    setResending(true);
    const supabase = createClient();
    await supabase.auth.resend({ type: "signup", email: unconfirmedEmail });
    setResending(false);
    setError("");
    setMessage("Verification email sent — check your inbox.");
    setUnconfirmedEmail("");
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <h1 className="text-lg font-semibold text-ink-primary">
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          {mode === "signin" ? "Welcome back to QA Platform" : "Set up access to QA Platform"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === "signup" && (
          <Input
            type="text"
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        )}
        <Input
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus={mode !== "signup"}
        />
        <Input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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

        {unconfirmedEmail && (
          <div className="flex flex-col gap-2 rounded-md bg-warning-subtle px-3.5 py-3 text-sm text-warning-subtle-fg">
            <p>Wrong password, or haven't verified your email yet?</p>
            <Button type="button" size="sm" variant="secondary" loading={resending} onClick={resendVerification}>
              Resend verification email
            </Button>
          </div>
        )}

        <Button type="submit" loading={loading} className="mt-1 w-full">
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-tertiary">
        {mode === "signin" ? (
          <>
            No account yet?{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setMode("signup");
                setError("");
                setMessage("");
                setUnconfirmedEmail("");
              }}
              className="font-medium text-accent hover:text-accent-hover"
            >
              Create one
            </a>
            {" · "}
            <Link href="/forgot-password" className="font-medium text-accent hover:text-accent-hover">
              Forgot password?
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setMode("signin");
                setError("");
                setMessage("");
                setUnconfirmedEmail("");
              }}
              className="font-medium text-accent hover:text-accent-hover"
            >
              Sign in
            </a>
          </>
        )}
      </p>
    </AuthLayout>
  );
}
