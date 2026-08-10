import { useState } from "react";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";

export default function Settings() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function changePassword(e) {
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Verify the current password before allowing a change.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });
    if (verifyError) {
      setError("Current password is incorrect.");
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
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("Password updated.");
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
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 380, margin: "80px auto", padding: "0 20px" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" style={{ fontSize: 14 }}>
          ← All projects
        </Link>
      </div>
      <h1 style={{ marginTop: 0 }}>Settings</h1>

      <form onSubmit={changePassword}>
        <input
          type="password"
          required
          placeholder="Current password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
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
          {loading ? "…" : "Change password"}
        </button>
        {message && <p style={{ color: "seagreen", marginTop: 12 }}>{message}</p>}
        {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
      </form>
    </div>
  );
}
