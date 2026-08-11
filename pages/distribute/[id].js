import { useState } from "react";
import QRCode from "qrcode";
import { createServerSupabase, createServiceClient } from "../../lib/supabase/server";
import ProjectShell from "../../components/layout/ProjectShell";
import TopNav from "../../components/layout/TopNav";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import PlatformBadge from "../../components/ui/PlatformBadge";
import AppIcon from "../../components/release/AppIcon";
import AppDetailsCard from "../../components/release/AppDetailsCard";
import OtherVersionsCard from "../../components/release/OtherVersionsCard";
import ReportIssueCard from "../../components/release/ReportIssueCard";
import { getExpiryStatus } from "../../lib/provisioning";
import {
  CalendarClock,
  Check,
  CircleAlert,
  Copy,
  Download,
  QrCode,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

// A release with no project (public, no-login upload) has nothing to show
// tabs for — just enough chrome to get back to the dashboard.
function MinimalShell({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopNav />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res); // enforces login via middleware already
  const { data: release } = await supabase
    .from("releases")
    .select("*, projects(id, name)")
    .eq("id", params.id)
    .single();

  if (!release) return { notFound: true };

  // project_id is null for public, no-login uploads — there's no sibling
  // "other versions" grouping for those (and .eq(null) would otherwise
  // match every other anonymous upload, not just this uploader's).
  let otherVersions = [];
  if (release.project_id) {
    const { data } = await supabase
      .from("releases")
      .select("id, platform, version, build_number, created_at, notes")
      .eq("project_id", release.project_id)
      .eq("status", "published")
      .neq("id", release.id)
      .order("created_at", { ascending: false })
      .limit(10);
    otherVersions = data || [];
  }

  const service = createServiceClient();
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;

  let itmsLink = null;
  let androidUrl = null;

  if (release.platform === "ios") {
    const manifestUrl = `${protocol}://${host}/api/manifest?releaseId=${release.id}`;
    itmsLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
  }

  if (release.platform === "android" && release.file_path) {
    const { data: publicFile } = service.storage.from("builds").getPublicUrl(release.file_path);
    androidUrl = publicFile.publicUrl || null;
  }

  const shareUrl = `${protocol}://${host}/share/${release.id}`;
  const rawQrSvg = await QRCode.toString(shareUrl, {
    type: "svg",
    margin: 1,
    color: { dark: "#000000", light: "#0000" },
  });
  const qrSvg = rawQrSvg.replace('fill="#000000"', 'fill="currentColor"');

  return { props: { release, itmsLink, androidUrl, otherVersions: otherVersions || [], qrSvg } };
}

function SigningNotice({ release }) {
  if (release.platform !== "ios") return null;
  const info = release.provisioning_info;

  if (info?.type === "Enterprise") {
    return (
      <div className="flex gap-2.5 rounded-md bg-success-subtle px-3.5 py-3 text-sm text-success-subtle-fg">
        <ShieldCheck size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Enterprise-signed — installs on any iPhone</p>
          <p className="mt-0.5 text-ink-secondary">
            No UDID registration needed. Just tap Install.
          </p>
        </div>
      </div>
    );
  }
  if (info?.type === "Development" || info?.type === "Ad Hoc") {
    return (
      <div className="flex gap-2.5 rounded-md bg-warning-subtle px-3.5 py-3 text-sm text-warning-subtle-fg">
        <TriangleAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Signed for registered devices only</p>
          <p className="mt-0.5 text-ink-secondary">
            This build uses a {info.type} profile {info.name ? `(${info.name})` : ""} with{" "}
            {info.deviceCount} registered device{info.deviceCount === 1 ? "" : "s"}. If a tester
            gets &quot;Unable to Download App&quot;, that device isn&apos;t registered yet.
          </p>
        </div>
      </div>
    );
  }
  if (!info?.type && release.ota_ready === false) {
    return (
      <div className="flex gap-2.5 rounded-md bg-danger-subtle px-3.5 py-3 text-sm text-danger-subtle-fg">
        <CircleAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Signing couldn&apos;t be verified for OTA install</p>
          <p className="mt-0.5 text-ink-secondary">
            {info?.error ? `${info.error}. ` : ""}Rebuild with an Ad Hoc or Enterprise profile in
            Xcode and re-upload.
          </p>
        </div>
      </div>
    );
  }
  return null;
}

function ExpiryNotice({ release }) {
  if (release.platform !== "ios") return null;
  const expiry = getExpiryStatus(release.provisioning_info);
  if (!expiry || expiry.status === "ok") return null;

  const expired = expiry.status === "expired";
  return (
    <div
      className={`flex gap-2.5 rounded-md px-3.5 py-3 text-sm ${
        expired ? "bg-danger-subtle text-danger-subtle-fg" : "bg-warning-subtle text-warning-subtle-fg"
      }`}
    >
      <CalendarClock size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">
          {expired ? "Provisioning profile has expired" : "Provisioning profile expiring soon"}
        </p>
        <p className="mt-0.5 text-ink-secondary">
          {expired
            ? "This build can no longer be installed. Re-sign and re-upload a new version."
            : `Installs will stop working in ${expiry.daysLeft} day${expiry.daysLeft === 1 ? "" : "s"}. Re-sign and upload a new build before then.`}
        </p>
      </div>
    </div>
  );
}

export default function Distribute({ release, itmsLink, androidUrl, otherVersions, qrSvg }) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/${release.id}` : "";
  const appName = release.app_name || release.projects?.name || "Untitled build";

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const Shell = release.projects ? ProjectShell : MinimalShell;
  const shellProps = release.projects ? { project: release.projects, active: null } : {};

  return (
    <Shell {...shellProps}>
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <Card className="flex flex-col gap-5 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <AppIcon src={release.app_icon} fallbackLabel={appName} />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold text-ink-primary">{appName}</h1>
                <p className="mt-0.5 text-sm text-ink-tertiary">
                  v{release.version}
                  {release.build_number ? ` (${release.build_number})` : ""}
                </p>
              </div>
            </div>
            <PlatformBadge platform={release.platform} className="shrink-0" />
          </div>

          <SigningNotice release={release} />
          <ExpiryNotice release={release} />

          <div>
            {release.platform === "ios" && (
              <a href={itmsLink} className="block">
                <Button className="w-full" size="md">
                  <Download size={15} strokeWidth={2.25} />
                  Install
                </Button>
              </a>
            )}
            {release.platform === "android" && androidUrl && (
              <a href={androidUrl} className="block">
                <Button className="w-full" size="md">
                  <Download size={15} strokeWidth={2.25} />
                  Install
                </Button>
              </a>
            )}
            {release.platform === "web" && release.web_url && (
              <a href={release.web_url} target="_blank" rel="noreferrer" className="block">
                <Button className="w-full" size="md">
                  Open app
                </Button>
              </a>
            )}
            <p className="mt-2 text-center text-xs text-ink-tertiary">
              {release.platform === "ios" &&
                "Requires this device's UDID to be registered in the app's provisioning profile."}
              {release.platform === "android" &&
                "Downloads the APK — you may need to allow installs from unknown sources."}
            </p>
          </div>

          {release.notes && (
            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">
                Release notes
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-secondary">{release.notes}</p>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-primary">Public share link</p>
              <p className="mt-0.5 truncate text-xs text-ink-tertiary">
                Anyone with this link can view and install — no login required.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setQrOpen((o) => !o)}
                aria-pressed={qrOpen}
              >
                <QrCode size={13} strokeWidth={2.25} />
                QR
              </Button>
              <Button variant="secondary" size="sm" onClick={copyLink}>
                {copied ? <Check size={13} strokeWidth={2.25} /> : <Copy size={13} strokeWidth={2.25} />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
          {qrOpen && (
            <div className="mt-4 flex justify-center border-t border-border pt-4">
              <div
                className="h-40 w-40 rounded-md bg-white p-2.5 text-neutral-950"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            </div>
          )}
        </Card>

        {release.project_id && <ReportIssueCard releaseId={release.id} />}
        <AppDetailsCard release={release} />
        <OtherVersionsCard releases={otherVersions} basePath="/distribute" />
      </div>
    </Shell>
  );
}
