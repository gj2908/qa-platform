import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "../../lib/supabase/client";
import { useCurrentUser } from "../../lib/useCurrentUser";
import { useOrgIds } from "../../lib/useOrgIds";
import Button from "../ui/Button";
import Link from "next/link";
import { ShieldAlert, LogOut } from "lucide-react";

// Blocks the app when the signed-in user belongs to at least one
// organization with org-enforced MFA and has no verified TOTP factor —
// same "org_admin decides, member is bound by it" shape as seat_limit.
// Needs its own DB round-trip (org membership + factor status), so per
// main/CLAUDE.md's gate convention this renders a three-state result:
// "checking" → a blocking loading shell (not null, so a refresh can't
// flash real content before this resolves), "required" → the real gate,
// "ok" → null.
export default function RequireMfaGate() {
  const user = useCurrentUser();
  const orgIds = useOrgIds(user?.email);
  const router = useRouter();
  const [status, setStatus] = useState("checking"); // checking | required | ok

  // /settings is where the actual enrollment UI (TwoFactorCard) lives —
  // this gate must never block the one page that lets someone satisfy
  // it, or a required-but-unenrolled user could never reach it.
  const onSettingsPage = router.pathname === "/settings";

  useEffect(() => {
    if (!orgIds) return;
    let cancelled = false;
    const supabase = createClient();

    async function check() {
      if (orgIds.length === 0) {
        if (!cancelled) setStatus("ok");
        return;
      }
      const { data: orgs } = await supabase.from("organizations").select("id").in("id", orgIds).eq("mfa_required", true);
      if (!orgs || orgs.length === 0) {
        if (!cancelled) setStatus("ok");
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerifiedFactor = (factors?.totp || []).some((f) => f.status === "verified");
      if (!cancelled) setStatus(hasVerifiedFactor ? "ok" : "required");
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [orgIds]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (status === "ok" || onSettingsPage) return null;

  if (status === "checking") {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-canvas">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 pb-10 pt-8 sm:items-center sm:pt-4">
      <div className="absolute inset-0 bg-neutral-950/50" aria-hidden="true" />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-warning-subtle text-warning-subtle-fg">
            <ShieldAlert size={14} strokeWidth={2.25} />
          </span>
          <h2 className="text-sm font-semibold text-ink-primary">Two-factor authentication required</h2>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <p className="text-sm text-ink-tertiary">
            An organization you belong to requires two-factor authentication on every account. Set it up in Settings to continue.
          </p>

          <Link href="/settings">
            <Button className="w-full">Go to Settings</Button>
          </Link>

          <button
            onClick={signOut}
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-ink-tertiary hover:text-ink-secondary"
          >
            <LogOut size={12} strokeWidth={2.25} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
