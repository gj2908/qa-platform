import { createServiceClient } from "../../../lib/supabase/server";
import { hashToken } from "../../../lib/apiTokens";
import { buildShareProps } from "../../../lib/buildShareProps";

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;

// Anonymous PIN check for a share link protected via
// pages/api/releases/share-settings.js. On success, returns the full
// install payload the page's getServerSideProps withheld — the PIN gate
// is enforced server-side, not just hidden client-side. Capped at 10
// attempts per 15 minutes per browser via a short-lived cookie counter.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const { releaseId, pin } = req.body || {};
  if (!releaseId || !pin) {
    res.status(400).json({ error: "Missing releaseId or pin" });
    return;
  }

  const cookieName = `pin_attempts_${releaseId}`;
  const attempts = parseInt(req.cookies?.[cookieName] || "0", 10) || 0;
  if (attempts >= MAX_ATTEMPTS) {
    res.status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }

  const supabase = createServiceClient();
  const { data: release } = await supabase
    .from("releases")
    .select("*, projects(name)")
    .eq("id", releaseId)
    .eq("status", "published")
    .single();

  if (!release) {
    res.status(404).json({ error: "Release not found" });
    return;
  }

  if (release.share_pin_hash && hashToken(pin) !== release.share_pin_hash) {
    res.setHeader(
      "Set-Cookie",
      `${cookieName}=${attempts + 1}; Path=/; Max-Age=${WINDOW_SECONDS}; HttpOnly; SameSite=Lax`
    );
    res.status(403).json({ error: "Incorrect PIN." });
    return;
  }

  const { itmsLink, otherVersions } = await buildShareProps(supabase, release, req);
  res.status(200).json({ ok: true, release, itmsLink, otherVersions });
}
