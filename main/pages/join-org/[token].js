import { useState } from "react";
import { useRouter } from "next/router";
import { createServiceClient } from "../../lib/supabase/server";
import AppShell from "../../components/layout/AppShell";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Building2, CircleAlert } from "lucide-react";

// Reached from an org_admin-shared invite link. The caller isn't a
// member yet, so org_role()-backed RLS can't be used to look the org
// up — same reasoning as api/organizations/join.js, which this page
// posts to. By the time this renders, middleware has already forced
// sign-in (redirectTo brings the visitor straight back here).
export async function getServerSideProps({ params }) {
  const service = createServiceClient();
  const { data: org } = await service
    .from("organizations")
    .select("id, name, logo_url, invite_enabled")
    .eq("invite_token", params.token)
    .maybeSingle();

  if (!org) return { props: { status: "invalid" } };
  if (!org.invite_enabled) return { props: { status: "disabled", orgName: org.name } };

  return {
    props: { status: "valid", token: params.token, orgName: org.name, orgLogoUrl: org.logo_url || null },
  };
}

export default function JoinOrg({ status, token, orgName, orgLogoUrl }) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    setJoining(true);
    setError("");
    const res = await fetch("/api/organizations/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setJoining(false);
      setError(data.error || "Couldn't join the organization.");
      return;
    }
    router.push(`/organizations/${data.orgId}`);
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 pt-12 text-center">
        {status === "valid" ? (
          <>
            {orgLogoUrl ? (
              <img src={orgLogoUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-subtle text-ink-secondary">
                <Building2 size={22} strokeWidth={2} />
              </span>
            )}
            <div>
              <h1 className="text-lg font-semibold text-ink-primary">Join {orgName}</h1>
              <p className="mt-1 text-sm text-ink-tertiary">
                You'll be added as a member with access to this organization's projects.
              </p>
            </div>
            <Card className="w-full p-5">
              <Button onClick={join} loading={joining} className="w-full">
                Join organization
              </Button>
              {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            </Card>
          </>
        ) : (
          <Card className="flex w-full flex-col items-center gap-2 p-6">
            <CircleAlert size={22} strokeWidth={2} className="text-ink-tertiary" />
            <h1 className="text-sm font-semibold text-ink-primary">
              {status === "disabled" ? "This invite link has been disabled" : "This invite link is invalid"}
            </h1>
            <p className="text-sm text-ink-tertiary">
              {status === "disabled"
                ? `Ask an admin of ${orgName} for a new one.`
                : "Double-check the link, or ask whoever shared it for a new one."}
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
