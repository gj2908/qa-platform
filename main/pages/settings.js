import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import AppShell from "../components/layout/AppShell";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import FormField from "../components/ui/FormField";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import SettingsSection from "../components/ui/SettingsSection";
import Switch from "../components/ui/Switch";
import { useCurrentUser } from "../lib/useCurrentUser";
import { useToast } from "../components/ui/ToastProvider";
import { CircleCheck, Bell, ShieldCheck, ShieldOff, Copy, BellOff, Mail, Download, MailPlus } from "lucide-react";
import { isPushSupported, getPushSubscriptionState, subscribeToPush, unsubscribeFromPush } from "../lib/pushSubscribe";
import { usePwaInstall } from "../lib/usePwaInstall";
import PwaInstallInstructions from "../components/layout/PwaInstallInstructions";

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

  async function toggle(next) {
    setWorking(true);
    try {
      if (!next) {
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Bell size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink-secondary" />
          <div>
            <h2 className="text-sm font-semibold text-ink-primary">Push notifications</h2>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              Get a browser notification on this device for task mentions and release publishes.
            </p>
          </div>
        </div>
        <Switch checked={state === "on"} onChange={toggle} loading={working || state === "checking" || !user} />
      </div>
    </Card>
  );
}

function InstallAppCard() {
  const [showInstructions, setShowInstructions] = useState(false);
  const { isStandalone, canPromptInstall, needsIOSInstructions, needsAndroidMenuFallback, promptInstall } =
    usePwaInstall();
  const showsInstructions = needsIOSInstructions || needsAndroidMenuFallback;
  const isActionable = canPromptInstall || showsInstructions;

  async function handleInstall() {
    if (canPromptInstall) {
      await promptInstall();
    } else if (showsInstructions) {
      setShowInstructions(true);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Download size={15} strokeWidth={2.25} className="text-ink-secondary" />
          <div>
            <h2 className="text-sm font-semibold text-ink-primary">Install app</h2>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              {isStandalone
                ? "You're using the installed app on this device."
                : "Add Vrsnify to your home screen or dock for quicker access."}
            </p>
          </div>
        </div>
        {isStandalone ? (
          <Badge tone="success" icon={CircleCheck}>
            Installed
          </Badge>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={!isActionable}
            title={isActionable ? undefined : "Not available in this browser"}
            onClick={handleInstall}
          >
            Install
          </Button>
        )}
      </div>
      <PwaInstallInstructions
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
        platform={needsIOSInstructions ? "ios" : "android"}
      />
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

const INVITE_PREFERENCE_OPTIONS = [
  { value: "ask", label: "Ask each time" },
  { value: "always", label: "Always send" },
  { value: "never", label: "Never send" },
];

function InvitePreferenceCard() {
  const toast = useToast();
  const user = useCurrentUser();
  const [preference, setPreference] = useState(null); // null = loading
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("invite_unregistered_preference")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setPreference(data?.invite_unregistered_preference || "ask"));
  }, [user?.id]);

  async function updatePreference(next) {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ invite_unregistered_preference: next })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPreference(next);
    toast.success("Preference saved.");
  }

  if (preference === null) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <MailPlus size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Collaborator invites</h2>
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        When you add someone who isn't registered yet as a project collaborator or org member, should Vrsnify ask you
        each time whether to email them an invite to sign up?
      </p>
      <div className="mt-4 max-w-xs">
        <Select
          value={preference}
          disabled={saving}
          onChange={(e) => updatePreference(e.target.value)}
        >
          {INVITE_PREFERENCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>
    </Card>
  );
}

function AccountCard() {
  const toast = useToast();
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function signOutEverywhere() {
    setSigningOutEverywhere(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setSigningOutEverywhere(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    window.location.href = "/login";
  }

  async function exportData() {
    setExporting(true);
    const res = await fetch("/api/account/export-data");
    setExporting(false);
    if (!res.ok) {
      toast.error("Couldn't export your data.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-ink-primary">Account</h2>
      <p className="mt-1 text-sm text-ink-tertiary">Manage where you're signed in and export a copy of your data.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" loading={exporting} onClick={exportData}>
          Export my data
        </Button>
        <Button variant="secondary" size="sm" loading={signingOutEverywhere} onClick={signOutEverywhere}>
          Sign out of all devices
        </Button>
      </div>
    </Card>
  );
}

export default function Settings() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">Settings</h1>
          <p className="mt-1 text-sm text-ink-tertiary">
            Security, notifications, and app install. Your name, avatar, and password live in{" "}
            <a href="/profile" className="text-accent hover:text-accent-hover">
              Profile
            </a>
            .
          </p>
        </div>

        <SettingsSection title="Security">
          <TwoFactorCard />
        </SettingsSection>

        <SettingsSection title="Notifications">
          <PushNotificationsCard />
          <NotificationPreferencesCard />
        </SettingsSection>

        <SettingsSection title="App">
          <InstallAppCard />
        </SettingsSection>

        <SettingsSection title="Collaboration">
          <InvitePreferenceCard />
        </SettingsSection>

        <SettingsSection title="Account">
          <AccountCard />
        </SettingsSection>
      </div>
    </AppShell>
  );
}
