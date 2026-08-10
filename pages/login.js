import { useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "../lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}${router.query.redirectTo || "/"}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 380, margin: "100px auto", textAlign: "center" }}>
      <h1>Sign in</h1>
      {sent ? (
        <p>Check <strong>{email}</strong> for a magic link.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 12, borderRadius: 6, border: "1px solid #ccc" }}
          />
          <button
            type="submit"
            style={{ width: "100%", padding: 10, borderRadius: 6, background: "#111", color: "#fff", border: "none" }}
          >
            Send magic link
          </button>
          {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
        </form>
      )}
    </div>
  );
}
