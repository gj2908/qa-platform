import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "../lib/supabase/client";
import AuthLayout from "../components/layout/AuthLayout";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { CircleAlert, CircleCheck } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const supabase = createClient();
    const redirectTo = router.query.redirectTo || "/";

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.push(redirectTo);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${redirectTo}` },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setMessage("Account created. You can now sign in.");
      setMode("signin");
    }
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
        <Input
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
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
