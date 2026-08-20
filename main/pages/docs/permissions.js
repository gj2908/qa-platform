import AppShell from "../../components/layout/AppShell";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { ROLE_META } from "../../components/ui/role";
import { ShieldCheck, Building2, FolderKanban, Info } from "lucide-react";

const PROJECT_ROLE_ORDER = ["owner", "editor", "commenter", "viewer"];

const PROJECT_CAPABILITIES = [
  { label: "View releases, install builds", roles: ["owner", "editor", "commenter", "viewer"] },
  { label: "Comment and use the board", roles: ["owner", "editor", "commenter"] },
  { label: "Publish and delete releases", roles: ["owner", "editor"] },
  { label: "Manage collaborators, webhooks, API tokens", roles: ["owner"] },
  { label: "Transfer ownership, delete the project", roles: ["owner"] },
];

const ORG_ROLE_ORDER = ["org_admin", "member"];
const ORG_ROLE_META = {
  org_admin: { label: "Admin", tone: "accent" },
  member: { label: "Member", tone: "neutral" },
};

const ORG_CAPABILITIES = [
  { label: "See the org, its members and project list", roles: ["org_admin", "member"] },
  { label: "Full owner-level access to every project in the org", roles: ["org_admin"] },
  { label: "Add/remove members, set org branding and defaults", roles: ["org_admin"] },
  { label: "Request the org's closure", roles: ["org_admin"] },
];

export default function PermissionsDocs() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} strokeWidth={2.25} className="text-ink-secondary" />
          <h1 className="text-xl font-semibold text-ink-primary">Roles &amp; permissions</h1>
        </div>
        <p className="-mt-3 text-sm text-ink-tertiary">
          Two separate role systems apply depending on whether a project belongs to an organization.
        </p>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <FolderKanban size={15} strokeWidth={2.25} className="text-ink-secondary" />
            <h2 className="text-sm font-semibold text-ink-primary">Project roles</h2>
          </div>
          <p className="mt-1.5 text-sm text-ink-tertiary">
            Set per person on a project's Collaborators page. Ordered highest to lowest access —
            each role includes everything below it.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PROJECT_ROLE_ORDER.map((r) => {
              const meta = ROLE_META[r];
              return <Badge key={r} tone={meta.tone}>{meta.label}</Badge>;
            })}
          </div>
          <CapabilityTable roleOrder={PROJECT_ROLE_ORDER} roleMeta={ROLE_META} capabilities={PROJECT_CAPABILITIES} />
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Building2 size={15} strokeWidth={2.25} className="text-ink-secondary" />
            <h2 className="text-sm font-semibold text-ink-primary">Organization roles</h2>
          </div>
          <p className="mt-1.5 text-sm text-ink-tertiary">
            An optional grouping layer above projects. Set per person on an org's page.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {ORG_ROLE_ORDER.map((r) => {
              const meta = ORG_ROLE_META[r];
              return <Badge key={r} tone={meta.tone}>{meta.label}</Badge>;
            })}
          </div>
          <CapabilityTable roleOrder={ORG_ROLE_ORDER} roleMeta={ORG_ROLE_META} capabilities={ORG_CAPABILITIES} />
        </Card>

        <Card className="flex items-start gap-2.5 p-4">
          <Info size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink-tertiary" />
          <p className="text-sm text-ink-secondary">
            An org admin gets full (owner-level) access to every project attached to their org
            automatically — no separate collaborator entry needed. A plain member does not: they
            only see a project if someone has also added them to it directly as a collaborator.
            Projects with no organization work exactly as before — nothing here changes personal,
            non-organizational use.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

function CapabilityTable({ roleOrder, roleMeta, capabilities }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-ink-tertiary">
            <th className="py-2 pr-3 font-medium">Can do</th>
            {roleOrder.map((r) => (
              <th key={r} className="px-2 py-2 text-center font-medium">
                {roleMeta[r].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {capabilities.map((c) => (
            <tr key={c.label} className="border-b border-border last:border-0">
              <td className="py-2.5 pr-3 text-ink-primary">{c.label}</td>
              {roleOrder.map((r) => (
                <td key={r} className="px-2 py-2.5 text-center">
                  {c.roles.includes(r) ? (
                    <span className="text-success">✓</span>
                  ) : (
                    <span className="text-ink-tertiary">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
