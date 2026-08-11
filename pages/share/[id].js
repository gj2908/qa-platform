import { useState } from "react";
import { createServiceClient } from "../../lib/supabase/server";
import { activateScheduledReleaseIfDue } from "../../lib/activateScheduledRelease";
import { isExpired, isRolledOut, needsPin } from "../../lib/shareGating";
import { buildShareProps } from "../../lib/buildShareProps";
import Logo from "../../components/layout/Logo";
import ThemeToggle from "../../components/ThemeToggle";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import EmptyState from "../../components/ui/EmptyState";
import InstallCard from "../../components/release/InstallCard";
import AppDetailsCard from "../../components/release/AppDetailsCard";
import OtherVersionsCard from "../../components/release/OtherVersionsCard";
import ReportIssueCard from "../../components/release/ReportIssueCard";
import { Clock, Lock, TimerOff } from "lucide-react";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServiceClient();
  let { data: release } = await supabase
    .from("releases")
    .select("*, projects(name)")
    .eq("id", params.id)
    .single();

  if (!release) return { notFound: true };

  if (release.status === "scheduled") {
    release = await activateScheduledReleaseIfDue(supabase, release, req);
  }
  if (release.status !== "published") return { notFound: true };

  if (isExpired(release)) {
    return { props: { gate: "expired" } };
  }
  if (!isRolledOut(release, req, res)) {
    let fallback = null;
    if (release.project_id) {
      const { data } = await supabase
        .from("releases")
        .select("id")
        .eq("project_id", release.project_id)
        .eq("platform", release.platform)
        .eq("channel", release.channel)
        .eq("status", "published")
        .neq("id", release.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      fallback = data?.id || null;
    }
    return { props: { gate: "rollout", fallbackReleaseId: fallback } };
  }
  if (needsPin(release)) {
    return {
      props: {
        gate: "pin",
        releaseId: release.id,
        // Enough to render the branded PIN screen — no install fields.
        preview: {
          app_name: release.app_name,
          app_icon: release.app_icon,
          version: release.version,
          build_number: release.build_number,
        },
      },
    };
  }

  const { itmsLink, otherVersions } = await buildShareProps(supabase, release, req);
  return { props: { gate: null, release, itmsLink, otherVersions } };
}

function PageChrome({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo compact />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}

function PinGate({ releaseId, preview, onUnlocked }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const appName = preview.app_name || "this build";

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/public/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseId, pin }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.ok) {
      onUnlocked(data);
    } else {
      setError(data.error || "Couldn't verify that PIN.");
    }
  }

  return (
    <Card className="flex flex-col items-center gap-4 p-6 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-fg">
        <Lock size={18} strokeWidth={2} />
      </span>
      <div>
        <h1 className="text-lg font-semibold text-ink-primary">Enter PIN to install {appName}</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          v{preview.version}
          {preview.build_number ? ` (${preview.build_number})` : ""}
        </p>
      </div>
      <form onSubmit={submit} className="flex w-full flex-col gap-3">
        <Input
          type="text"
          inputMode="numeric"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          error={!!error}
          autoFocus
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={submitting} disabled={!pin.trim()} className="w-full">
          Unlock
        </Button>
      </form>
    </Card>
  );
}

export default function SharePage(props) {
  const [unlocked, setUnlocked] = useState(null);

  if (props.gate === "expired") {
    return (
      <PageChrome>
        <EmptyState icon={TimerOff} title="This link has expired" description="Ask the release owner for a new link." />
      </PageChrome>
    );
  }

  if (props.gate === "rollout") {
    return (
      <PageChrome>
        <EmptyState
          icon={Clock}
          title="This release is rolling out gradually"
          description="Check back soon — it's not available on this device yet."
          action={
            props.fallbackReleaseId && (
              <a href={`/share/${props.fallbackReleaseId}`}>
                <Button variant="secondary">Install the previous version</Button>
              </a>
            )
          }
        />
      </PageChrome>
    );
  }

  if (props.gate === "pin" && !unlocked) {
    return (
      <PageChrome>
        <PinGate releaseId={props.releaseId} preview={props.preview} onUnlocked={setUnlocked} />
      </PageChrome>
    );
  }

  const release = unlocked?.release || props.release;
  const itmsLink = unlocked?.itmsLink ?? props.itmsLink;
  const otherVersions = unlocked?.otherVersions ?? props.otherVersions ?? [];

  return (
    <PageChrome>
      <InstallCard release={release} itmsLink={itmsLink} />
      <div className="mt-5 flex flex-col gap-5">
        {release.project_id && <ReportIssueCard releaseId={release.id} />}
        <AppDetailsCard release={release} />
        <OtherVersionsCard releases={otherVersions} basePath="/share" />
      </div>
    </PageChrome>
  );
}
