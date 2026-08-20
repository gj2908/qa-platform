import { useState } from "react";
import { createServerSupabase } from "../../../lib/supabase/server";
import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Textarea from "../../../components/ui/Textarea";
import Select from "../../../components/ui/Select";
import FormField from "../../../components/ui/FormField";
import Badge from "../../../components/ui/Badge";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/ToastProvider";
import { getAvatarColor } from "../../../lib/avatarColor";
import { activityMetaFor } from "../../../lib/activityMeta";
import { relativeTime } from "../../../lib/format";
import {
  UserPlus,
  Trash2,
  CircleAlert,
  Users,
  FolderKanban,
  Download,
  FolderPlus,
  Building2,
  Clock,
  Settings,
} from "lucide-react";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: org } = await supabase.from("organizations").select("*").eq("id", params.id).single();
  if (!org) return { notFound: true };

  const { data: role } = await supabase.rpc("org_role", { p_org_id: params.id });
  if (!role) return { notFound: true };

  const { data: members } = await supabase
    .from("org_members")
    .select("email, role, created_at")
    .eq("org_id", params.id)
    .order("role");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("org_id", params.id)
    .order("name");

  // Cross-project activity feed — same query activity-export.js already
  // runs for CSV export, just capped and rendered inline instead of
  // streamed. Visible to every member (RLS's "members read activity"
  // already allows this via project_role()'s org-admin fallback; the
  // export endpoint's admin-only gate is an application choice specific
  // to bulk export, not a hard permission boundary).
  const projectIds = (projects || []).map((p) => p.id);
  const nameById = Object.fromEntries((projects || []).map((p) => [p.id, p.name]));
  let projectActivity = [];
  if (projectIds.length > 0) {
    const { data: activityRows } = await supabase
      .from("project_activity")
      .select("id, project_id, actor_email, action, detail, created_at")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .limit(20);
    projectActivity = (activityRows || []).map((a) => ({ ...a, project_name: nameById[a.project_id] || null }));
  }

  // Org-level governance events (member/branding/domain/lifecycle) live
  // in a separate table from project activity — merge the two feeds by
  // timestamp so "Recent activity" reads as one unified org history.
  const { data: orgActivityRows } = await supabase
    .from("org_activity")
    .select("id, actor_email, action, detail, created_at")
    .eq("org_id", params.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const orgActivity = (orgActivityRows || []).map((a) => ({ ...a, project_name: null }));

  const activity = [...projectActivity, ...orgActivity]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20);

  // Projects the current user owns that aren't already in this org —
  // populates the "Add project" picker, admins only (cheap to skip the
  // query otherwise).
  let ownedUnattached = [];
  if (role === "org_admin") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: owned } = await supabase
      .from("project_collaborators")
      .select("projects(id, name, org_id)")
      .eq("email", user.email)
      .eq("role", "owner");
    ownedUnattached = (owned || [])
      .map((row) => row.projects)
      .filter((p) => p && p.org_id !== params.id);
  }

  return {
    props: { org, role, members: members || [], projects: projects || [], ownedUnattached, activity },
  };
}

const ROLE_META = {
  org_admin: { label: "Admin", tone: "accent" },
  member: { label: "Member", tone: "neutral" },
};

export default function OrganizationDetail({
  org,
  role: myRole,
  members: initial,
  projects: initialProjects,
  ownedUnattached,
  activity,
}) {
  const toast = useToast();
  const [members, setMembers] = useState(initial);
  const [projects, setProjects] = useState(initialProjects);
  const [unattached, setUnattached] = useState(ownedUnattached || []);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [addingProject, setAddingProject] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const isAdmin = myRole === "org_admin";
  const seatsUsed = members.length;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function addMember(e) {
    e.preventDefault();
    // Accepts one email or many, pasted separated by commas/newlines/
    // whitespace — same single endpoint either way, just called once
    // per address so each add gets its own invite-email/seat-limit
    // handling exactly as it already does for a single add.
    const emails = [...new Set(email.split(/[\s,]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
    const invalid = emails.filter((e) => !EMAIL_RE.test(e));
    if (emails.length === 0) return;
    if (invalid.length > 0) {
      setError(`Not a valid email: ${invalid.join(", ")}`);
      return;
    }

    setAdding(true);
    setError("");
    let addedCount = 0;
    let invitedCount = 0;
    const failures = [];
    for (const normalizedEmail of emails) {
      const res = await fetch("/api/organizations/members/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, email: normalizedEmail, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        failures.push(`${normalizedEmail}: ${data.error || "failed"}`);
        continue;
      }
      addedCount += 1;
      if (data.invited) invitedCount += 1;
      setMembers((m) => {
        const withoutExisting = m.filter((x) => x.email !== normalizedEmail);
        return [...withoutExisting, { email: normalizedEmail, role, created_at: new Date().toISOString() }];
      });
    }
    setAdding(false);

    if (addedCount > 0) {
      setEmail("");
      toast.success(
        addedCount === 1
          ? invitedCount > 0
            ? "Member added — invite email sent."
            : "Member added."
          : `${addedCount} member${addedCount === 1 ? "" : "s"} added${invitedCount > 0 ? `, ${invitedCount} invited` : ""}.`
      );
    }
    if (failures.length > 0) {
      setError(failures.join("; "));
    }
  }

  async function addProject(e) {
    e.preventDefault();
    if (selectedProjectIds.length === 0) return;
    setAddingProject(true);
    const targets = unattached.filter((p) => selectedProjectIds.includes(p.id));
    const addedTargets = [];
    for (const target of targets) {
      const res = await fetch("/api/organizations/set-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: target.id, orgId: org.id }),
      });
      if (res.ok) addedTargets.push(target);
    }
    setAddingProject(false);
    if (addedTargets.length === 0) {
      toast.error("Couldn't add the selected project(s).");
      return;
    }
    const addedIds = new Set(addedTargets.map((t) => t.id));
    setUnattached((u) => u.filter((p) => !addedIds.has(p.id)));
    setProjects((p) => [...p, ...addedTargets.map((t) => ({ id: t.id, name: t.name }))].sort((a, b) => a.name.localeCompare(b.name)));
    if (addedTargets.length < targets.length) {
      toast.error(`Added ${addedTargets.length} of ${targets.length} projects — some failed.`);
    } else {
      toast.success(addedTargets.length === 1 ? "Project added to the organization." : `${addedTargets.length} projects added to the organization.`);
    }
    setSelectedProjectIds([]);
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setBusy(true);
    const res = await fetch("/api/organizations/members/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, email: removeTarget.email }),
    });
    setBusy(false);
    if (res.ok) {
      setMembers((m) => m.filter((x) => x.email !== removeTarget.email));
      setRemoveTarget(null);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't remove that member.");
      setRemoveTarget(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {org.logo_url ? (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-subtle p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={org.logo_url} alt={org.name} className="h-full w-full object-contain" />
              </span>
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg">
                <Building2 size={24} strokeWidth={2} />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold text-ink-primary">{org.name}</h1>
                {org.domain && <Badge tone="neutral">{org.domain}</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-ink-tertiary">
                {isAdmin ? "You're an admin of this organization." : "You're a member of this organization."}{" "}
                <a href="/docs/permissions" className="text-accent hover:text-accent-hover">
                  What can each role do?
                </a>
              </p>
            </div>
          </div>
          {isAdmin && (
            <a href={`/organizations/${org.id}/settings`} className="shrink-0">
              <Button variant="secondary" size="sm">
                <Settings size={14} strokeWidth={2.25} />
                Settings
              </Button>
            </a>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatTile icon={FolderKanban} label="Projects" value={projects.length} />
          <StatTile icon={Users} label="Members" value={members.length} />
          <StatTile
            icon={UserPlus}
            label="Seats"
            value={org.seat_limit ? `${seatsUsed} / ${org.seat_limit}` : `${seatsUsed}`}
          />
        </div>

        {isAdmin && org.seat_limit && org.seat_limit - seatsUsed <= 1 && (
          <p className="flex items-center gap-1.5 rounded-md bg-warning-subtle px-3.5 py-2.5 text-sm text-warning-subtle-fg">
            <CircleAlert size={14} />
            {org.seat_limit - seatsUsed <= 0
              ? "No seats left — remove a member or ask your platform operator to raise the seat limit before adding another."
              : "Only 1 seat left on this organization."}
          </p>
        )}

        {error && (
          <p className="flex items-center gap-1.5 rounded-md bg-danger-subtle px-3.5 py-2.5 text-sm text-danger-subtle-fg">
            <CircleAlert size={14} />
            {error}
          </p>
        )}

        {activity.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Clock size={15} strokeWidth={2.25} className="text-ink-secondary" />
              <h2 className="text-sm font-semibold text-ink-primary">Recent activity</h2>
            </div>
            <div className="mt-4 flex flex-col gap-3.5">
              {(showAllActivity ? activity : activity.slice(0, 5)).map((a) => {
                const meta = activityMetaFor(a.action);
                const Icon = meta.icon;
                return (
                  <div key={a.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-secondary">
                      <Icon size={12} strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink-primary">
                        <span className="font-medium">{a.actor_email}</span> {meta.label}
                        {a.project_name ? <span className="text-ink-tertiary"> in {a.project_name}</span> : null}
                        {a.detail ? <span className="text-ink-tertiary"> — {a.detail}</span> : null}
                      </p>
                      <p className="text-xs text-ink-tertiary">{relativeTime(a.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {activity.length > 5 && (
              <button
                onClick={() => setShowAllActivity((s) => !s)}
                className="mt-3 text-xs font-medium text-accent hover:text-accent-hover"
              >
                {showAllActivity ? "Show less" : `View ${activity.length - 5} more`}
              </button>
            )}
          </Card>
        )}

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FolderKanban size={15} strokeWidth={2.25} className="text-ink-secondary" />
              <h2 className="text-sm font-semibold text-ink-primary">Projects</h2>
            </div>
            {isAdmin && (
              <a href={`/api/organizations/${org.id}/activity-export`}>
                <Button variant="secondary" size="sm">
                  <Download size={13} strokeWidth={2.25} />
                  Export activity
                </Button>
              </a>
            )}
          </div>

          {isAdmin && unattached.length > 0 && (
            <form onSubmit={addProject} className="mt-4 flex flex-col gap-3">
              <FormField label={`Add your project${unattached.length === 1 ? "" : "s"} (select one or more)`}>
                <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                  {unattached.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-ink-primary hover:bg-subtle">
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(p.id)}
                        onChange={(e) =>
                          setSelectedProjectIds((ids) =>
                            e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id)
                          )
                        }
                        className="h-3.5 w-3.5 rounded border-border accent-accent"
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </FormField>
              <Button type="submit" loading={addingProject} disabled={selectedProjectIds.length === 0} className="self-start">
                <FolderPlus size={15} strokeWidth={2.25} />
                {selectedProjectIds.length > 1 ? `Add ${selectedProjectIds.length} projects` : "Add"}
              </Button>
            </form>
          )}

          {projects.length === 0 ? (
            <p className="mt-3 text-sm text-ink-tertiary">
              No projects assigned yet — add one above, or from a project's own settings.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-border border-t border-border">
              {projects.map((p) => (
                <a
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between py-2 text-sm text-ink-primary hover:text-accent"
                >
                  {p.name}
                </a>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users size={15} strokeWidth={2.25} className="text-ink-secondary" />
              <h2 className="text-sm font-semibold text-ink-primary">Members</h2>
            </div>
            <span className="text-xs text-ink-tertiary">
              {seatsUsed} seat{seatsUsed === 1 ? "" : "s"} used{org.seat_limit ? ` / ${org.seat_limit}` : ""}
            </span>
          </div>

          {isAdmin && (
            <form onSubmit={addMember} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <FormField label="Email (paste several to bulk-invite)">
                  <Textarea
                    rows={1}
                    placeholder="teammate@company.com, another@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </FormField>
              </div>
              <div className="w-full sm:w-40">
                <FormField label="Role">
                  <Select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="member">Member</option>
                    <option value="org_admin">Admin</option>
                  </Select>
                </FormField>
              </div>
              <Button type="submit" loading={adding} disabled={!email.trim()}>
                <UserPlus size={15} strokeWidth={2.25} />
                Add
              </Button>
            </form>
          )}

          <div className="mt-4 divide-y divide-border border-t border-border">
            {members.map((m) => {
              const meta = ROLE_META[m.role];
              const color = getAvatarColor(m.email);
              return (
                <div key={m.email} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${color.bg} ${color.text}`}
                    >
                      {m.email[0].toUpperCase()}
                    </span>
                    <p className="truncate text-sm text-ink-primary">{m.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {isAdmin && (
                      <button
                        onClick={() => setRemoveTarget(m)}
                        title="Remove member"
                        className="rounded-md p-1.5 text-ink-tertiary transition-colors hover:bg-danger-subtle hover:text-danger"
                      >
                        <Trash2 size={14} strokeWidth={2.25} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title={`Remove ${removeTarget?.email}?`}
        description="They'll lose the org-wide access this membership grants to any project under this organization."
        confirmLabel="Remove"
        loading={busy}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </AppShell>
  );
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-subtle text-ink-secondary">
        <Icon size={17} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight text-ink-primary">{value}</p>
        <p className="truncate text-xs text-ink-tertiary">{label}</p>
      </div>
    </Card>
  );
}

