import { useState } from "react";
import AdminShell from "../components/AdminShell";
import { createServiceClient } from "../lib/supabase";
import { Trash2 } from "lucide-react";

const THRESHOLD_FIELDS = [
  { key: "approval_reminder_hours", label: "Approval reminder threshold", unit: "hours", placeholder: "24" },
  { key: "task_due_reminder_enabled", label: "Task due-date reminders enabled", unit: "true/false", placeholder: "true" },
  { key: "upload_max_attempts", label: "Upload rate limit — max attempts", unit: "per window", placeholder: "10" },
  { key: "upload_window_minutes", label: "Upload rate limit — window", unit: "minutes", placeholder: "60" },
  { key: "report_issue_max_attempts", label: "Report-issue rate limit — max attempts", unit: "per window", placeholder: "20" },
  { key: "report_issue_window_minutes", label: "Report-issue rate limit — window", unit: "minutes", placeholder: "60" },
  { key: "register_device_max_attempts", label: "Register-device rate limit — max attempts", unit: "per window", placeholder: "10" },
  { key: "register_device_window_minutes", label: "Register-device rate limit — window", unit: "minutes", placeholder: "60" },
  { key: "activity_retention_days", label: "Data retention — delete log rows older than", unit: "days, blank = never", placeholder: "" },
];

export async function getServerSideProps() {
  const service = createServiceClient();
  const { data: settingsRows } = await service.from("platform_settings").select("key, value");
  const settings = Object.fromEntries((settingsRows || []).map((r) => [r.key, r.value]));

  const { data: dbAdmins } = await service.from("admin_allowlist").select("email, added_by, added_at").order("added_at");

  const envAdmins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  return { props: { settings, dbAdmins: dbAdmins || [], envAdmins } };
}

export default function AdminSettings({ settings: initialSettings, dbAdmins: initialDbAdmins, envAdmins }) {
  const [settings, setSettings] = useState(initialSettings);
  const [savingKey, setSavingKey] = useState(null);
  const [dbAdmins, setDbAdmins] = useState(initialDbAdmins);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  async function saveThreshold(key) {
    setSavingKey(key);
    const res = await fetch("/api/settings/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: settings[key] || "" }),
    });
    setSavingKey(null);
    if (!res.ok) alert("Couldn't save that setting.");
  }

  async function addAdmin(e) {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    setAddingAdmin(true);
    setAdminError("");
    const res = await fetch("/api/admins/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newAdminEmail.trim() }),
    });
    setAddingAdmin(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setDbAdmins((a) => [...a, { email: newAdminEmail.trim().toLowerCase(), added_by: "you", added_at: new Date().toISOString() }]);
      setNewAdminEmail("");
    } else {
      setAdminError(data.error || "Couldn't add that admin.");
    }
  }

  async function runRetentionCleanup() {
    const days = settings.activity_retention_days;
    if (!days || !confirm(`Permanently delete log rows older than ${days} days across every project? This can't be undone.`)) return;
    setRunningCleanup(true);
    setCleanupResult(null);
    const res = await fetch("/api/data-retention/run", { method: "POST" });
    setRunningCleanup(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setCleanupResult(data.deleted);
    } else {
      alert(data.error || "Cleanup failed.");
    }
  }

  async function removeAdmin(email) {
    if (!confirm(`Remove ${email} as a platform admin?`)) return;
    const res = await fetch("/api/admins/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      setDbAdmins((a) => a.filter((x) => x.email !== email));
    } else {
      alert("Couldn't remove that admin.");
    }
  }

  return (
    <AdminShell>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Settings</h1>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Thresholds
        </div>
        <p className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Leave blank to use the built-in default.
        </p>
        <div className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
          {THRESHOLD_FIELDS.map((f) => (
            <div key={f.key} data-testid={`threshold-${f.key}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">{f.label}</p>
                <p className="text-xs text-slate-400">{f.unit}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={settings[f.key] || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="h-8 w-24 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <button
                  onClick={() => saveThreshold(f.key)}
                  disabled={savingKey === f.key}
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  {savingKey === f.key ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Data retention
        </div>
        <div className="bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manually triggered, not a cron — set the threshold above, then run this whenever you want to reclaim
            space. Deletes rows older than the threshold from project_activity, crash_reports, page_view_events,
            install_events, webhook_deliveries, and rate_limit_events, across every project. Nothing runs
            automatically; the free-tier database is small enough that this is worth checking before assuming you
            need it.
          </p>
          <button
            onClick={runRetentionCleanup}
            disabled={runningCleanup || !settings.activity_retention_days}
            className="mt-3 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {runningCleanup ? "Running…" : "Run cleanup now"}
          </button>
          {cleanupResult && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Deleted:{" "}
              {Object.entries(cleanupResult)
                .map(([table, count]) => `${count} ${table}`)
                .join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Platform admins
        </div>
        <div className="bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Admins added here are additive to (never a replacement for) the ADMIN_EMAILS environment variable —
            env-var admins can&apos;t be removed from this page.
          </p>

          {adminError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{adminError}</p>}

          <form onSubmit={addAdmin} className="mt-3 flex items-center gap-2">
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="h-8 flex-1 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={addingAdmin || !newAdminEmail.trim()}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              Add
            </button>
          </form>

          <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
            {envAdmins.map((email) => (
              <div key={email} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-300">{email}</span>
                <span className="text-xs text-slate-400">from environment</span>
              </div>
            ))}
            {dbAdmins.map((a) => (
              <div key={a.email} data-testid={`db-admin-${a.email}`} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-300">{a.email}</span>
                <button
                  onClick={() => removeAdmin(a.email)}
                  aria-label={`Remove ${a.email}`}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
