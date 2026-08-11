import { useEffect, useState } from "react";
import { createServiceClient } from "../../lib/supabase/server";
import { detectEnv, safariRedirectUrl } from "../../lib/browserDetect";
import Logo from "../../components/layout/Logo";
import ThemeToggle from "../../components/ThemeToggle";
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
  CircleAlert,
  Compass,
  Download,
  MonitorSmartphone,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

export async function getServerSideProps({ params, req }) {
  const supabase = createServiceClient();
  const { data: release } = await supabase
    .from("releases")
    .select("*, projects(name)")
    .eq("id", params.id)
    .eq("status", "published")
    .single();

  if (!release) return { notFound: true };

  // project_id is null for public, no-login uploads — .eq(null) would
  // otherwise match every other anonymous upload, not just this one.
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

  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;

  let itmsLink = null;
  let androidUrl = null;

  if (release.platform === "ios") {
    const manifestUrl = `${protocol}://${host}/api/manifest?releaseId=${release.id}`;
    itmsLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
  }

  if (release.platform === "android" && release.file_path) {
    const { data: publicFile } = supabase.storage.from("builds").getPublicUrl(release.file_path);
    androidUrl = publicFile.publicUrl || null;
  }

  return { props: { release, itmsLink, androidUrl, otherVersions: otherVersions || [] } };
}

export default function SharePage({ release, itmsLink, androidUrl, otherVersions }) {
  const [env, setEnv] = useState(null);
  const appName = release.app_name || release.projects?.name || "Untitled build";

  useEffect(() => {
    setEnv(detectEnv());
  }, []);

  const showInstallButton =
    release.platform !== "ios" || !env || (env.isSafari && !env.isNonSafariIOSBrowser);
  const expiry = release.platform === "ios" ? getExpiryStatus(release.provisioning_info) : null;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo compact />
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-[420px]">
          <Card className="flex flex-col gap-5 p-5 sm:p-6">
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

            {env?.isNonSafariIOSBrowser && release.platform === "ios" && (
              <div className="flex flex-col gap-2.5 rounded-md bg-warning-subtle px-3.5 py-3.5 text-sm text-warning-subtle-fg">
                <div className="flex gap-2.5">
                  <Compass size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Open this in Safari to install</p>
                    <p className="mt-0.5 text-ink-secondary">
                      iOS only allows app installs from Safari. Tap below to reopen this page there.
                    </p>
                  </div>
                </div>
                <a href={safariRedirectUrl()}>
                  <Button size="sm" className="w-full">
                    Open in Safari
                  </Button>
                </a>
                <p className="text-xs text-ink-secondary">
                  If nothing happens, tap the <strong>⋯</strong> or share icon in your browser's
                  toolbar and choose <strong>Open in Safari</strong>.
                </p>
              </div>
            )}

            {release.platform === "ios" && release.provisioning_info?.type === "Enterprise" && (
              <div className="flex gap-2.5 rounded-md bg-success-subtle px-3.5 py-3 text-sm text-success-subtle-fg">
                <ShieldCheck size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Enterprise-signed — installs on any iPhone</p>
                  <p className="mt-0.5 text-ink-secondary">
                    No UDID registration needed. Just tap Install.
                  </p>
                </div>
              </div>
            )}
            {release.platform === "ios" &&
              (release.provisioning_info?.type === "Development" ||
                release.provisioning_info?.type === "Ad Hoc") && (
                <div className="flex gap-2.5 rounded-md bg-warning-subtle px-3.5 py-3 text-sm text-warning-subtle-fg">
                  <TriangleAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Signed for registered devices only</p>
                    <p className="mt-0.5 text-ink-secondary">
                      This build uses a {release.provisioning_info.type} profile{" "}
                      {release.provisioning_info.name ? `(${release.provisioning_info.name})` : ""} with{" "}
                      {release.provisioning_info.deviceCount} registered device
                      {release.provisioning_info.deviceCount === 1 ? "" : "s"}. If you get
                      &quot;Unable to Download App&quot;, this device isn&apos;t registered yet.
                    </p>
                  </div>
                </div>
              )}
            {release.platform === "ios" &&
              !release.provisioning_info?.type &&
              release.ota_ready === false && (
                <div className="flex gap-2.5 rounded-md bg-danger-subtle px-3.5 py-3 text-sm text-danger-subtle-fg">
                  <CircleAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Signing couldn&apos;t be verified for OTA install</p>
                    <p className="mt-0.5 text-ink-secondary">
                      {release.provisioning_info?.error ? `${release.provisioning_info.error}. ` : ""}
                      Ask the release owner to rebuild with an Ad Hoc or Enterprise profile.
                    </p>
                  </div>
                </div>
              )}

            {expiry && expiry.status !== "ok" && (
              <div
                className={`flex gap-2.5 rounded-md px-3.5 py-3 text-sm ${
                  expiry.status === "expired"
                    ? "bg-danger-subtle text-danger-subtle-fg"
                    : "bg-warning-subtle text-warning-subtle-fg"
                }`}
              >
                <CalendarClock size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">
                    {expiry.status === "expired"
                      ? "Provisioning profile has expired"
                      : "Provisioning profile expiring soon"}
                  </p>
                  <p className="mt-0.5 text-ink-secondary">
                    {expiry.status === "expired"
                      ? "This build can no longer be installed. Ask the release owner to upload a new version."
                      : `Installs will stop working in ${expiry.daysLeft} day${expiry.daysLeft === 1 ? "" : "s"}.`}
                  </p>
                </div>
              </div>
            )}

            {env?.isDesktopModeIPad && release.platform === "ios" && (
              <div className="flex gap-2.5 rounded-md bg-accent-subtle px-3.5 py-3 text-sm text-accent-subtle-fg">
                <MonitorSmartphone size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Switch to mobile site to install</p>
                  <p className="mt-0.5 text-ink-secondary">
                    This page is loading in Desktop Site mode. In Safari, tap the{" "}
                    <strong>ᴀᴀ</strong> icon in the address bar → <strong>Request Mobile Website</strong>,
                    then tap Install again.
                  </p>
                </div>
              </div>
            )}

            <div>
              {release.platform === "ios" && showInstallButton && (
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

          <div className="mt-5 flex flex-col gap-5">
            {release.project_id && <ReportIssueCard releaseId={release.id} />}
            <AppDetailsCard release={release} />
            <OtherVersionsCard releases={otherVersions} basePath="/share" />
          </div>
        </div>
      </div>
    </div>
  );
}
