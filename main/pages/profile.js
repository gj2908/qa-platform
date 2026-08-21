import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import AppShell from "../components/layout/AppShell";
import FormField from "../components/ui/FormField";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { useCurrentUser, useAvatarUrl } from "../lib/UserContext";
import { useToast } from "../components/ui/ToastProvider";
import { CircleAlert, CircleCheck, BadgeCheck } from "lucide-react";

function ProfileCard() {
  const toast = useToast();
  const user = useCurrentUser();
  const contextAvatarUrl = useAvatarUrl();
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || initialized) return;
    setFullName(user.user_metadata?.full_name || "");
    setAvatarUrl(contextAvatarUrl || "");
    setInitialized(true);
  }, [user, initialized, contextAvatarUrl]);

  async function save(e) {
    e.preventDefault();
    setError("");
    const trimmed = fullName.trim();
    if (!trimmed) {
      setError("Name can't be empty.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
    if (authError) {
      setSaving(false);
      setError(authError.message);
      return;
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: trimmed, avatar_url: avatarUrl.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (profileError) {
      setError(profileError.message);
      return;
    }
    toast.success("Profile updated.");
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink-primary">Profile</h2>
        {user && (
          <Badge tone={user.email_confirmed_at ? "success" : "warning"} icon={user.email_confirmed_at ? BadgeCheck : CircleAlert}>
            {user.email_confirmed_at ? "Verified" : "Unverified"}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        Your name, shown to collaborators on shared projects.
        {user?.email ? ` Signed in as ${user.email}.` : ""}
      </p>

      <form onSubmit={save} className="mt-5 flex flex-col gap-4">
        <FormField label="Full name" htmlFor="fullName" required error={error}>
          <Input
            id="fullName"
            required
            placeholder="Jane Cooper"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={!!error}
          />
        </FormField>
        <FormField label="Avatar URL" htmlFor="avatarUrl" hint="A link to an image, shown instead of your initials.">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" onError={(e) => (e.target.style.visibility = "hidden")} />
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-full bg-subtle" />
            )}
            <Input
              id="avatarUrl"
              type="url"
              placeholder="https://…"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="flex-1"
            />
          </div>
        </FormField>
        <div>
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ChangePasswordCard() {
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
  );
}

export default function Profile() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">Profile</h1>
          <p className="mt-1 text-sm text-ink-tertiary">Your name, avatar, and password.</p>
        </div>

        <ProfileCard />

        <ChangePasswordCard />
      </div>
    </AppShell>
  );
}
