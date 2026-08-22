import { useRef, useState } from "react";
import { createServerSupabase } from "../../../lib/supabase/server";
import { createClient } from "../../../lib/supabase/client";
import AppShell from "../../../components/layout/AppShell";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import InviteEmailPrompt from "../../../components/ui/InviteEmailPrompt";
import StatTile from "../../../components/ui/StatTile";
import ActivityCard from "../../../components/organization/ActivityCard";
import ProjectsCard from "../../../components/organization/ProjectsCard";
import MembersCard from "../../../components/organization/MembersCard";
import { useToast } from "../../../components/ui/ToastProvider";
import { CircleAlert, Users, FolderKanban, Building2, UserPlus, Settings } from "lucide-react";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: org } = await supabase.from("organizations").select("*").eq("id", params.id).single();
  if (!org) return { notFound: true };

  const { data: role } = await supabase.rpc("org_role", { p_org_id: params.id });
  if (!role) return { notFound: true };

  const { data: membersRaw } = await supabase
    .from("org_members")
    .select("email, role, created_at")
    .eq("org_id", params.id)
    .order("role");

  let members = membersRaw || [];
  if (members.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("email, full_name, avatar_url")
      .in("email", members.map((m) => m.email));
    const profileByEmail = Object.fromEntries((profiles || []).map((p) => [p.email, p]));
    members = members.map((m) => ({
      ...m,
      full_name: profileByEmail[m.email]?.full_name || null,
      avatar_url: profileByEmail[m.email]?.avatar_url || null,
    }));
  }

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
    props: { org, role, members, projects: projects || [], ownedUnattached, activity },
  };
}

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
  const [offboardTarget, setOffboardTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [offboardBusy, setOffboardBusy] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [addingProject, setAddingProject] = useState(false);
  const [removeProjectTarget, setRemoveProjectTarget] = useState(null);
  const [removeProjectBusy, setRemoveProjectBusy] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvRows, setCsvRows] = useState([]);
  const [csvError, setCsvError] = useState("");
  const [csvInviting, setCsvInviting] = useState(false);
  // { emails, resolve } while InviteEmailPrompt is open, awaiting the
  // admin's send/skip choice for the unregistered addresses in the
  // current batch — `resolve` settles the Promise getSendInviteDecision
  // handed back to addMember/inviteFromCsv.
  const [invitePrompt, setInvitePrompt] = useState(null);
  const fileInputRef = useRef(null);

  const isAdmin = myRole === "org_admin";

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const CSV_MAX_ROWS = 200;

  async function savePreference(preference) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ invite_unregistered_preference: preference }).eq("id", user.id);
  }

  // Checks which of `emailList` don't have an account yet and, if any
  // don't and the admin hasn't already set an always/never preference,
  // opens InviteEmailPrompt and waits for their choice. Returns the
  // sendInvite boolean to attach to every /members/add call in this batch.
  async function getSendInviteDecision(emailList) {
    try {
      const res = await fetch("/api/organizations/members/check-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, emails: emailList }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const unregistered = data.unregistered || [];
      if (unregistered.length === 0) return false;
      if (data.invitePreference === "always") return true;
      if (data.invitePreference === "never") return false;
      return new Promise((resolve) => {
        setInvitePrompt({ emails: unregistered, resolve });
      });
    } catch (e) {
      return false;
    }
  }

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

    const sendInvite = await getSendInviteDecision(emails);
    setInvitePrompt(null);

    setAdding(true);
    setError("");
    let addedCount = 0;
    let invitedCount = 0;
    const failures = [];
    for (const normalizedEmail of emails) {
      const res = await fetch("/api/organizations/members/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, email: normalizedEmail, role, sendInvite }),
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

  // Alternative to the paste-emails textarea above: lets an admin set a
  // different role per row instead of one shared role for the whole
  // batch. Parsed and previewed entirely client-side (no parsing library
  // — this is a hand-rolled two-column split) so the admin can eyeball
  // the rows before any invite emails actually go out.
  async function handleCsvFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError("");
    setCsvRows([]);
    setCsvFileName(file.name);

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      setCsvError("That CSV looks empty.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Skip a header row only when it's unambiguous — the first line's
    // second column isn't literally one of the two valid role values.
    const firstRole = (lines[0].split(",")[1] || "").trim();
    const dataLines = firstRole === "member" || firstRole === "org_admin" ? lines : lines.slice(1);

    if (dataLines.length > CSV_MAX_ROWS) {
      setCsvError(`That CSV has ${dataLines.length} rows — cap is ${CSV_MAX_ROWS}. Split it into smaller files.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const rows = dataLines
      .map((line) => {
        const [rawEmail, rawRole] = line.split(",");
        const rowEmail = (rawEmail || "").trim().toLowerCase();
        const trimmedRole = (rawRole || "").trim();
        const rowRole = trimmedRole === "" ? "member" : trimmedRole;
        const valid = EMAIL_RE.test(rowEmail) && (rowRole === "member" || rowRole === "org_admin");
        return { email: rowEmail, role: rowRole, valid };
      })
      .filter((r) => r.email.length > 0);

    if (rows.length === 0) {
      setCsvError("No rows found in that CSV.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setCsvRows(rows);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function inviteFromCsv() {
    const validRows = csvRows.filter((r) => r.valid);
    if (validRows.length === 0) return;

    const sendInvite = await getSendInviteDecision(validRows.map((r) => r.email));
    setInvitePrompt(null);

    setCsvInviting(true);
    setError("");
    let addedCount = 0;
    let invitedCount = 0;
    const failures = [];
    for (const row of validRows) {
      const res = await fetch("/api/organizations/members/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, email: row.email, role: row.role, sendInvite }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        failures.push(`${row.email}: ${data.error || "failed"}`);
        continue;
      }
      addedCount += 1;
      if (data.invited) invitedCount += 1;
      setMembers((m) => {
        const withoutExisting = m.filter((x) => x.email !== row.email);
        return [...withoutExisting, { email: row.email, role: row.role, created_at: new Date().toISOString() }];
      });
    }
    setCsvInviting(false);

    if (addedCount > 0) {
      setCsvRows([]);
      setCsvFileName("");
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

  function toggleProjectSelect(projectId, checked) {
    setSelectedProjectIds((ids) => (checked ? [...ids, projectId] : ids.filter((id) => id !== projectId)));
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

  async function confirmRemoveProject() {
    if (!removeProjectTarget) return;
    setRemoveProjectBusy(true);
    const res = await fetch("/api/organizations/set-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: removeProjectTarget.id, orgId: null }),
    });
    setRemoveProjectBusy(false);
    if (res.ok) {
      // Not re-added to `unattached` here — whether the remover still owns
      // it (the only condition that would make it eligible again) isn't
      // known client-side without another round trip; a reload recomputes
      // it correctly via getServerSideProps.
      setProjects((p) => p.filter((x) => x.id !== removeProjectTarget.id));
      toast.success(`Removed "${removeProjectTarget.name}" from the organization.`);
      setRemoveProjectTarget(null);
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't remove that project.");
      setRemoveProjectTarget(null);
    }
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

  async function confirmOffboard() {
    if (!offboardTarget) return;
    setOffboardBusy(true);
    const res = await fetch("/api/organizations/members/offboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: org.id, email: offboardTarget.email }),
    });
    const data = await res.json().catch(() => ({}));
    setOffboardBusy(false);
    if (res.ok) {
      setMembers((m) => m.filter((x) => x.email !== offboardTarget.email));
      setOffboardTarget(null);
      toast.success(
        `Offboarded — removed from ${data.removedFromProjects?.length || 0} project(s).`
      );
      if (data.skippedOwnerOf?.length > 0) {
        toast.error(
          `Still owns ${data.skippedOwnerOf.length} project(s) — transfer ownership there first to fully remove access.`
        );
      }
    } else {
      setError(data.error || "Couldn't offboard that member.");
      setOffboardTarget(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
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
                <h1 className="break-words text-xl font-semibold text-ink-primary">{org.name}</h1>
                {org.domain && <Badge tone="neutral">{org.domain}</Badge>}
                <Badge tone={isAdmin ? "accent" : "neutral"}>{isAdmin ? "Admin" : "Member"}</Badge>
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

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <StatTile icon={FolderKanban} label="Projects" value={projects.length} />
          <StatTile icon={Users} label="Members" value={members.length} />
          <StatTile
            icon={UserPlus}
            label="Seats"
            value={org.seat_limit ? `${members.length} / ${org.seat_limit}` : `${members.length}`}
          />
        </div>

        {error && (
          <p className="flex items-center gap-1.5 rounded-md bg-danger-subtle px-3.5 py-2.5 text-sm text-danger-subtle-fg">
            <CircleAlert size={14} />
            {error}
          </p>
        )}

        <ActivityCard org={org} isAdmin={isAdmin} activity={activity} />

        <ProjectsCard
          org={org}
          isAdmin={isAdmin}
          projects={projects}
          unattached={unattached}
          selectedProjectIds={selectedProjectIds}
          onToggleProjectSelect={toggleProjectSelect}
          onAddProjects={addProject}
          addingProject={addingProject}
          onRequestRemove={setRemoveProjectTarget}
        />

        <MembersCard
          org={org}
          isAdmin={isAdmin}
          members={members}
          email={email}
          setEmail={setEmail}
          role={role}
          setRole={setRole}
          adding={adding}
          onAddMember={addMember}
          fileInputRef={fileInputRef}
          onCsvFile={handleCsvFile}
          csvFileName={csvFileName}
          csvRows={csvRows}
          csvError={csvError}
          csvInviting={csvInviting}
          onInviteFromCsv={inviteFromCsv}
          onRequestOffboard={setOffboardTarget}
          onRequestRemove={setRemoveTarget}
        />
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

      <ConfirmDialog
        open={!!offboardTarget}
        title={`Offboard ${offboardTarget?.email}?`}
        description="Removes their org membership and revokes their direct access to every project in this organization — not just this org's own membership. Projects they own are skipped (transfer ownership there first)."
        confirmLabel="Offboard"
        loading={offboardBusy}
        onConfirm={confirmOffboard}
        onCancel={() => setOffboardTarget(null)}
      />

      <ConfirmDialog
        open={!!removeProjectTarget}
        title={`Remove "${removeProjectTarget?.name}" from ${org.name}?`}
        description="The project becomes standalone again — its board, releases, and collaborators are unaffected, but org-wide admin access to it is revoked."
        confirmLabel="Remove"
        loading={removeProjectBusy}
        onConfirm={confirmRemoveProject}
        onCancel={() => setRemoveProjectTarget(null)}
      />

      <InviteEmailPrompt
        open={!!invitePrompt}
        emails={invitePrompt?.emails || []}
        onSendInvite={async (remember) => {
          if (remember) await savePreference("always");
          invitePrompt.resolve(true);
        }}
        onSkip={async (remember) => {
          if (remember) await savePreference("never");
          invitePrompt.resolve(false);
        }}
      />
    </AppShell>
  );
}
