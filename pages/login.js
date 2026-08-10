import { useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "../lib/supabase/client";

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
      <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        {message && <p style={{ color: "seagreen", marginTop: 12 }}>{message}</p>}
        {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
      </form>
      <p style={{ fontSize: 13, marginTop: 16 }}>
        {mode === "signin" ? (
          <>
            No account yet?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setMode("signup"); setError(""); setMessage(""); }} style={{ color: "#111" }}>
              Create one
            </a>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setMode("signin"); setError(""); setMessage(""); }} style={{ color: "#111" }}>
              Sign in
            </a>
          </>
        )}
      </p>
    </div>
  );
}
