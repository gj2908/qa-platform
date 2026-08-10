import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "../lib/supabase/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState("email");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function requestCode(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("code");
    setMessage("Check your email for a 6-digit code.");
  }

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
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }
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

  const inputStyle = {
    width: "100%",
    padding: 10,
    marginBottom: 12,
    borderRadius: 6,
    border: "1px solid #ccc",
    boxSizing: "border-box",
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 380, margin: "100px auto", textAlign: "center" }}>
      <h1>Reset password</h1>
      {step === "email" ? (
        <form onSubmit={requestCode}>
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              background: "#111",
              color: "#fff",
              border: "none",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "…" : "Send code"}
          </button>
          {message && <p style={{ color: "seagreen", marginTop: 12 }}>{message}</p>}
          {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
          <p style={{ fontSize: 13, color: "#888", marginTop: 12 }}>
            We'll email you a 6-digit code to reset your password.
          </p>
        </form>
      ) : (
        <form onSubmit={resetPassword}>
          <input
            type="text"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              background: "#111",
              color: "#fff",
              border: "none",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "…" : "Reset password"}
          </button>
          {message && <p style={{ color: "seagreen", marginTop: 12 }}>{message}</p>}
          {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
          <p style={{ fontSize: 13, marginTop: 12 }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setError("");
                setMessage("");
                setStep("email");
              }}
              style={{ color: "#111" }}
            >
              Resend code
            </a>
          </p>
        </form>
      )}
      <p style={{ fontSize: 13, marginTop: 16 }}>
        Remembered your password?{" "}
        <Link href="/login" style={{ color: "#111" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
