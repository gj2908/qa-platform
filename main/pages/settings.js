import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import AppShell from "../components/layout/AppShell";
import FormField from "../components/ui/FormField";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { useCurrentUser } from "../lib/useCurrentUser";
import { useToast } from "../components/ui/ToastProvider";
import { CircleAlert, CircleCheck, Bell, BadgeCheck } from "lucide-react";
import { isPushSupported, getPushSubscriptionState, subscribeToPush, unsubscribeFromPush } from "../lib/pushSubscribe";

function ProfileCard() {
  const toast = useToast();
  const user = useCurrentUser();
  const [fullName, setFullName] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && !initialized) {
      setFullName(user.user_metadata?.full_name || "");
      setInitialized(true);
    }
  }, [user, initialized]);

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
      .update({ full_name: trimmed })
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
        <div>
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PushNotificationsCard() {
  const toast = useToast();
  const user = useCurrentUser();
  const [state, setState] = useState("checking"); // checking | unsupported | off | on
  const [working, setWorking] = useState(false);

  useEffect(() => {
    getPushSubscriptionState().then(setState);
  }, []);

  async function toggle() {
    setWorking(true);
    try {
      if (state === "on") {
        await unsubscribeFromPush();
        setState("off");
        toast.success("Push notifications disabled on this browser.");
      } else {
        await subscribeToPush(user.email);
        setState("on");
        toast.success("Push notifications enabled on this browser.");
      }
    } catch (e) {
      toast.error(e.message || "Couldn't update push notifications.");
    }
    setWorking(false);
  }

  if (state === "unsupported") return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell size={15} strokeWidth={2.25} className="text-ink-secondary" />
          <div>
            <p className="text-sm font-medium text-ink-primary">Push notifications</p>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              Get a browser notification on this device for task mentions and release publishes.
            </p>
          </div>
        </div>
        <Button
          variant={state === "on" ? "primary" : "secondary"}
          size="sm"
          loading={working || state === "checking" || !user}
          onClick={toggle}
        >
          {state === "on" ? "On" : "Off"}
        </Button>
      </div>
    </Card>
  );
}

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
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">Settings</h1>
          <p className="mt-1 text-sm text-ink-tertiary">Manage your profile and account security.</p>
        </div>

        <ProfileCard />

        <PushNotificationsCard />

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
