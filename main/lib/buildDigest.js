import { getExpiryStatus } from "./provisioning";
import { renderEmail, EMAIL_STYLES } from "./emailClient";

const LOOKBACK_HOURS = 24;

// Pulls together everything a project's digest cares about from data
// this app already computes elsewhere (tester feedback tasks, published
// releases, pending approvals, provisioning-profile expiry) rather than
// introducing a new "digest events" table — the digest is a read-only
// summary, not a log.
export async function buildDigest(service, project) {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  const { data: newFeedback } = await service
    .from("tasks")
    .select("id, title, ai_severity")
    .eq("project_id", project.id)
    .eq("source", "tester_feedback")
    .gte("created_at", since);

  const { data: newReleases } = await service
    .from("releases")
    .select("id, app_name, version, build_number, platform")
    .eq("project_id", project.id)
    .eq("status", "published")
    .gte("created_at", since);

  const { data: pendingReleases } = await service
    .from("releases")
    .select("id, app_name, version, platform")
    .eq("project_id", project.id)
    .eq("status", "pending_review");

  const { data: iosReleases } = await service
    .from("releases")
    .select("app_name, version, provisioning_info")
    .eq("project_id", project.id)
    .eq("status", "published")
    .eq("platform", "ios");

  const expiring = (iosReleases || [])
    .map((r) => ({ ...r, expiry: getExpiryStatus(r.provisioning_info) }))
    .filter((r) => r.expiry && r.expiry.status !== "ok");

  const feedback = newFeedback || [];
  const releases = newReleases || [];
  const pending = pendingReleases || [];

  const hasContent = feedback.length > 0 || releases.length > 0 || pending.length > 0 || expiring.length > 0;

  const list = (items) => `<ul ${EMAIL_STYLES.ul}>${items.map((li) => `<li ${EMAIL_STYLES.li}>${li}</li>`).join("")}</ul>`;

  const sections = [];
  if (releases.length > 0) {
    sections.push(
      `<h3 ${EMAIL_STYLES.h3}>New releases</h3>${list(
        releases.map((r) => `${r.app_name || "Build"} v${r.version}${r.build_number ? ` (${r.build_number})` : ""} — ${r.platform}`)
      )}`
    );
  }
  if (feedback.length > 0) {
    sections.push(
      `<h3 ${EMAIL_STYLES.h3}>New tester feedback (${feedback.length})</h3>${list(
        feedback.map((f) => `${f.title}${f.ai_severity ? ` — ${f.ai_severity}` : ""}`)
      )}`
    );
  }
  if (pending.length > 0) {
    sections.push(
      `<h3 ${EMAIL_STYLES.h3}>Pending approval</h3>${list(
        pending.map((r) => `${r.app_name || "Build"} v${r.version} — ${r.platform}`)
      )}`
    );
  }
  if (expiring.length > 0) {
    sections.push(
      `<h3 ${EMAIL_STYLES.h3}>Provisioning profiles</h3>${list(
        expiring.map(
          (r) =>
            `${r.app_name || "Build"} v${r.version} — ${
              r.expiry.status === "expired" ? "expired" : `expires in ${r.expiry.daysLeft} day${r.expiry.daysLeft === 1 ? "" : "s"}`
            }`
        )
      )}`
    );
  }

  const projectUrl = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/projects/${project.id}` : null;

  const html = renderEmail({
    heading: `${project.name} — daily digest`,
    bodyHtml: hasContent
      ? sections.join("")
      : `<p ${EMAIL_STYLES.p}>Nothing new in the last ${LOOKBACK_HOURS} hours.</p>`,
    ctaLabel: "Open project",
    ctaUrl: projectUrl,
  });

  return {
    hasContent,
    subject: `${project.name} — daily digest`,
    html,
  };
}
