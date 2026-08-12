import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "../lib/supabase/client";
import AuthLayout from "../components/layout/AuthLayout";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import OtpCodeInput from "../components/ui/OtpCodeInput";
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
  // Set once signup succeeds, holding the email awaiting confirmation —
  // renders the inline code-entry form in place of the signup form. A
  // not-yet-confirmed user can't reach a session (signInWithPassword
  // rejects them outright, and VerifyEmailGate needs an existing session
  // to render), so this page is the only place they can complete
  // verification via code instead of the emailed link.
  const [awaitingSignupOtp, setAwaitingSignupOtp] = useState("");
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState("");
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
      setAwaitingSignupOtp(email);
    }
  }

  async function resendVerification() {
    setResending(true);
    const supabase = createClient();
    const redirectTo = router.query.redirectTo || "/dashboard";
    await supabase.auth.resend({
      type: "signup",
      email: unconfirmedEmail,
      options: { emailRedirectTo: `${window.location.origin}${redirectTo}` },
    });
    setResending(false);
    setError("");
    setMessage("Verification email sent — check your inbox.");
  }

  async function verifySignupOtp(code) {
    setOtpSubmitting(true);
    setOtpError("");
    const supabase = createClient();
    const targetEmail = awaitingSignupOtp || unconfirmedEmail;
    const { error } = await supabase.auth.verifyOtp({
      email: targetEmail,
      token: code,
      type: "signup",
    });
    setOtpSubmitting(false);
    if (error) {
      setOtpError(error.message);
      return;
    }
    router.push(router.query.redirectTo || "/dashboard");
  }

  async function resendSignupOtp() {
    setResending(true);
    const supabase = createClient();
    const redirectTo = router.query.redirectTo || "/dashboard";
    await supabase.auth.resend({
      type: "signup",
      email: awaitingSignupOtp || unconfirmedEmail,
      options: { emailRedirectTo: `${window.location.origin}${redirectTo}` },
    });
    setResending(false);
    setOtpError("");
  }

  if (awaitingSignupOtp) {
    return (
      <AuthLayout>
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-ink-primary">Verify your email</h1>
          <p className="mt-1 text-sm text-ink-tertiary">
            {message || `We sent a confirmation link and a code to ${awaitingSignupOtp}.`}
          </p>
        </div>

        <OtpCodeInput
          email={awaitingSignupOtp}
          onSubmit={verifySignupOtp}
          submitting={otpSubmitting}
          onResend={resendSignupOtp}
          resending={resending}
          error={otpError}
          sentLabel="Enter the code, or click the link in the email — either one signs you in."
        />

        <p className="mt-5 text-center text-sm text-ink-tertiary">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setAwaitingSignupOtp("");
              setMode("signin");
              setMessage("");
              setOtpError("");
            }}
            className="font-medium text-accent hover:text-accent-hover"
          >
            Back to sign in
          </a>
        </p>
      </AuthLayout>
    );
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
          <div className="flex flex-col gap-3 rounded-md bg-warning-subtle px-3.5 py-3 text-sm text-warning-subtle-fg">
            <div className="flex flex-col gap-2">
              <p>Wrong password, or haven't verified your email yet?</p>
              <Button type="button" size="sm" variant="secondary" loading={resending} onClick={resendVerification}>
                Resend verification email
              </Button>
            </div>
            <OtpCodeInput
              email={unconfirmedEmail}
              onSubmit={verifySignupOtp}
              submitting={otpSubmitting}
              error={otpError}
              sentLabel="Have a verification code instead?"
            />
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
