import { useState } from "react";
import { createClient } from "../lib/supabase/client";
import AppShell from "../components/layout/AppShell";
import FormField from "../components/ui/FormField";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { CircleAlert, CircleCheck } from "lucide-react";

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

  return (
    <AppShell title="Settings" breadcrumbs={[{ label: "Projects", href: "/dashboard" }, { label: "Settings" }]}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">Settings</h1>
          <p className="mt-1 text-sm text-ink-tertiary">Manage your account security.</p>
        </div>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink-primary">Change password</h2>
          <p className="mt-1 text-sm text-ink-tertiary">
            You'll need to confirm your current password first.
          </p>

          <form onSubmit={changePassword} className="mt-5 flex flex-col gap-4">
            <FormField label="Current password" htmlFor="oldPassword" required>
              <Input
                id="oldPassword"
                type="password"
                required
                placeholder="••••••••"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </FormField>
            <FormField label="New password" htmlFor="newPassword" required hint="At least 6 characters.">
              <Input
                id="newPassword"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </FormField>
            <FormField label="Confirm new password" htmlFor="confirmPassword" required>
              <Input
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={!!error}
              />
            </FormField>

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

            <div>
              <Button type="submit" loading={loading}>
                Update password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
