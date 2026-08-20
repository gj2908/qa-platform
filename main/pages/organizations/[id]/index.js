import { useState } from "react";
import { createServerSupabase } from "../../../lib/supabase/server";
import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import FormField from "../../../components/ui/FormField";
import Badge from "../../../components/ui/Badge";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/ToastProvider";
import { getAvatarColor } from "../../../lib/avatarColor";
import { UserPlus, Trash2, CircleAlert, Users, FolderKanban, Palette, Download, FolderPlus } from "lucide-react";

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
    props: { org, role, members: members || [], projects: projects || [], ownedUnattached },
  };
}

const ROLE_META = {
  org_admin: { label: "Admin", tone: "accent" },
  member: { label: "Member", tone: "neutral" },
};

export default function OrganizationDetail({ org, role: myRole, members: initial, projects: initialProjects, ownedUnattached }) {
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
  const [addProjectId, setAddProjectId] = useState("");
  const [addingProject, setAddingProject] = useState(false);

  const isAdmin = myRole === "org_admin";
  const seatsUsed = members.length;

  async function addMember(e) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    setAdding(true);
    setError("");
    const res = await fetch("/api/organizations/members/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, email: normalizedEmail, role }),
    });
    setAdding(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Couldn't add that member.");
      return;
    }
    setMembers((m) => {
      const withoutExisting = m.filter((x) => x.email !== normalizedEmail);
      return [...withoutExisting, { email: normalizedEmail, role, created_at: new Date().toISOString() }];
    });
    setEmail("");
    toast.success(data.invited ? "Member added — invite email sent." : "Member added.");
  }

  async function addProject(e) {
    e.preventDefault();
    if (!addProjectId) return;
    setAddingProject(true);
    const target = unattached.find((p) => p.id === addProjectId);
    const res = await fetch("/api/organizations/set-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: addProjectId, orgId: org.id }),
    });
    setAddingProject(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Couldn't add that project.");
      return;
    }
    setUnattached((u) => u.filter((p) => p.id !== addProjectId));
    if (target) setProjects((p) => [...p, { id: target.id, name: target.name }].sort((a, b) => a.name.localeCompare(b.name)));
    setAddProjectId("");
    toast.success("Project added to the organization.");
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
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">{org.name}</h1>
          <p className="mt-1 text-sm text-ink-tertiary">
            {isAdmin ? "You're an admin of this organization." : "You're a member of this organization."}
          </p>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 rounded-md bg-danger-subtle px-3.5 py-2.5 text-sm text-danger-subtle-fg">
            <CircleAlert size={14} />
            {error}
          </p>
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
            <form onSubmit={addProject} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <FormField label="Add one of your projects">
                  <Select value={addProjectId} onChange={(e) => setAddProjectId(e.target.value)}>
                    <option value="">Choose a project…</option>
                    {unattached.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <Button type="submit" loading={addingProject} disabled={!addProjectId}>
                <FolderPlus size={15} strokeWidth={2.25} />
                Add
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
                <FormField label="Email">
                  <Input
                    type="email"
                    placeholder="teammate@company.com"
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

        {isAdmin && <BrandingCard org={org} />}
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

function BrandingCard({ org }) {
  const [logoUrl, setLogoUrl] = useState(org.logo_url || "");
  const [accentColor, setAccentColor] = useState(org.accent_color || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

  async function save(e) {
    e.preventDefault();
    if (accentColor && !HEX_RE.test(accentColor)) {
      setError("Accent color must be a hex code, e.g. #3358d4");
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/organizations/branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, logoUrl: logoUrl.trim() || null, accentColor: accentColor.trim() || null }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Couldn't save branding.");
      return;
    }
    setSaved(true);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Palette size={15} strokeWidth={2.25} className="text-ink-secondary" />
        <h2 className="text-sm font-semibold text-ink-primary">Branding</h2>
      </div>
      <p className="mt-1 text-sm text-ink-tertiary">
        Shown on this org's public install/share pages instead of the default Vrsnify logo.
      </p>

      <form onSubmit={save} className="mt-4 flex flex-col gap-3">
        <FormField label="Logo URL" hint="A publicly reachable image URL — square works best">
          <Input
            type="url"
            placeholder="https://yourcompany.com/logo.png"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
        </FormField>
        <FormField label="Accent color" error={error} hint="Hex code, e.g. #3358d4">
          <Input
            placeholder="#3358d4"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            error={!!error}
          />
        </FormField>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving} className="w-fit">
            Save branding
          </Button>
          {saved && <span className="text-sm text-success">Saved</span>}
        </div>
      </form>
    </Card>
  );
}
