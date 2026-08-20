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
import { CircleAlert, CircleCheck, Bell, BadgeCheck, ShieldCheck, ShieldOff, Copy, BellOff, Mail, Download } from "lucide-react";
import { isPushSupported, getPushSubscriptionState, subscribeToPush, unsubscribeFromPush } from "../lib/pushSubscribe";
import { usePwaInstall } from "../lib/usePwaInstall";
import PwaInstallInstructions from "../components/layout/PwaInstallInstructions";

function ProfileCard() {
  const toast = useToast();
  const user = useCurrentUser();
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || initialized) return;
    setFullName(user.user_metadata?.full_name || "");
    setInitialized(true);
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setAvatarUrl(data?.avatar_url || ""));
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

function TwoFactorCard() {
  const toast = useToast();
  const [factors, setFactors] = useState(null); // null = loading
  const [enrolling, setEnrolling] = useState(null); // { factorId, qrCode, secret }
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp || []).filter((f) => f.status === "verified"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function startEnroll() {
    setWorking(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll(e) {
    e.preventDefault();
    if (!enrolling || code.trim().length !== 6) return;
    setWorking(true);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
    if (challengeError) {
      setWorking(false);
      toast.error(challengeError.message);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrolling.factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setWorking(false);
    if (verifyError) {
      toast.error(verifyError.message);
      return;
    }
    toast.success("Two-factor authentication enabled.");
    setEnrolling(null);
    setCode("");
    refresh();
  }

  async function disable(factorId) {
    setWorking(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor authentication disabled.");
    refresh();
  }

  if (factors === null) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        {factors.length > 0 ? (
          <ShieldCheck size={15} strokeWidth={2.25} className="text-success" />
        ) : (
          <ShieldOff size={15} strokeWidth={2.25} className="text-ink-secondary" />
        )}
        <h2 className="text-sm font-semibold text-ink-primary">Two-factor authentication</h2>
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        {factors.length > 0
          ? "An authenticator app is required at sign-in, on top of your password."
          : "Add an authenticator app (Google Authenticator, 1Password, etc.) for a second sign-in step."}
      </p>

      {factors.length > 0 ? (
        <div className="mt-4">
          <Button variant="secondary" size="sm" loading={working} onClick={() => disable(factors[0].id)}>
            Disable
          </Button>
        </div>
      ) : enrolling ? (
        <form onSubmit={confirmEnroll} className="mt-4 flex flex-col gap-3">
          {enrolling.qrCode && (
            <img src={enrolling.qrCode} alt="Scan with your authenticator app" className="h-40 w-40 rounded border border-border" />
          )}
          <p className="flex items-center gap-1.5 text-xs text-ink-tertiary">
            Can't scan? Enter this key manually: <code className="rounded bg-subtle px-1 py-0.5">{enrolling.secret}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(enrolling.secret);
                toast.success("Copied.");
              }}
            >
              <Copy size={12} strokeWidth={2.25} />
            </button>
          </p>
          <FormField label="6-digit code" htmlFor="totpCode" required>
            <Input
              id="totpCode"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
          </FormField>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEnrolling(null)} disabled={working}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={working} disabled={code.length !== 6}>
              Confirm
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4">
          <Button variant="secondary" size="sm" loading={working} onClick={startEnroll}>
            Set up
          </Button>
        </div>
      )}
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

function InstallAppCard() {
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const { isStandalone, canPromptInstall, needsIOSInstructions, needsAndroidMenuFallback, promptInstall } =
    usePwaInstall();
  const isSupported = canPromptInstall || needsIOSInstructions;

  async function handleInstall() {
    if (canPromptInstall) {
      await promptInstall();
    } else if (needsIOSInstructions) {
      setShowIOSInstructions(true);
    }
  }

  let description = "Add Vrsnify to your home screen or dock for quicker access.";
  if (isStandalone) description = "You're using the installed app on this device.";
  else if (needsAndroidMenuFallback) description = 'Open your browser\'s ⋮ menu and tap "Install app" to add it.';

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Download size={15} strokeWidth={2.25} className="text-ink-secondary" />
          <div>
            <p className="text-sm font-medium text-ink-primary">Install app</p>
            <p className="mt-0.5 text-xs text-ink-tertiary">{description}</p>
          </div>
        </div>
        {isStandalone ? (
          <Badge tone="success" icon={CircleCheck}>
            Installed
          </Badge>
        ) : (
          !needsAndroidMenuFallback && (
            <Button
              variant="secondary"
              size="sm"
              disabled={!isSupported}
              title={isSupported ? undefined : "Not available in this browser"}
              onClick={handleInstall}
            >
              Install
            </Button>
          )
        )}
      </div>
      <PwaInstallInstructions open={showIOSInstructions} onClose={() => setShowIOSInstructions(false)} />
    </Card>
  );
}

function NotificationPreferencesCard() {
  const toast = useToast();
  const user = useCurrentUser();
  const [projects, setProjects] = useState(null); // null = loading
  const [prefsByProject, setPrefsByProject] = useState({});
  const [working, setWorking] = useState(null); // project_id currently saving

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("projects")
      .select("id, name")
      .order("name")
      .then(async ({ data: projectRows }) => {
        setProjects(projectRows || []);
        const { data: prefRows } = await supabase
          .from("notification_preferences")
          .select("project_id, muted, email_enabled")
          .eq("user_id", user.id);
        setPrefsByProject(Object.fromEntries((prefRows || []).map((p) => [p.project_id, p])));
      });
  }, [user]);

  async function setPref(projectId, patch) {
    setWorking(projectId);
    const supabase = createClient();
    const current = prefsByProject[projectId] || { muted: false, email_enabled: true };
    const next = { ...current, ...patch };
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, project_id: projectId, ...next }, { onConflict: "user_id,project_id" });
    setWorking(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPrefsByProject((p) => ({ ...p, [projectId]: next }));
  }

  if (!projects || projects.length === 0) return null;

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-ink-primary">Notification preferences</h2>
      <p className="mt-1 text-sm text-ink-tertiary">Mute the bell or emails for individual projects — this only affects you.</p>

      <div className="mt-4 flex flex-col divide-y divide-border">
        {projects.map((p) => {
          const pref = prefsByProject[p.id] || { muted: false, email_enabled: true };
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <p className="min-w-0 truncate text-sm text-ink-primary">{p.name}</p>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant={pref.muted ? "primary" : "secondary"}
                  size="sm"
                  loading={working === p.id}
                  onClick={() => setPref(p.id, { muted: !pref.muted })}
                  title={pref.muted ? "Unmute" : "Mute"}
                >
                  {pref.muted ? <BellOff size={13} strokeWidth={2.25} /> : <Bell size={13} strokeWidth={2.25} />}
                </Button>
                <Button
                  variant={pref.email_enabled ? "secondary" : "primary"}
                  size="sm"
                  loading={working === p.id}
                  onClick={() => setPref(p.id, { email_enabled: !pref.email_enabled })}
                  title={pref.email_enabled ? "Emails on" : "Emails off"}
                >
                  <Mail size={13} strokeWidth={2.25} />
                </Button>
              </div>
            </div>
          );
        })}
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

        <TwoFactorCard />

        <PushNotificationsCard />

        <InstallAppCard />

        <NotificationPreferencesCard />

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
