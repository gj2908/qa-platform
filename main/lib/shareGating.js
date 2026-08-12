const ROLLOUT_COOKIE = "qa_bucket";

// Reads (or assigns) a stable 0-99 bucket for an anonymous visitor via a
// long-lived cookie, so staged-rollout decisions are consistent across
// repeat visits from the same browser rather than re-randomized per
// request.
export function getRolloutBucket(req, res) {
  const existing = parseInt(req.cookies?.[ROLLOUT_COOKIE], 10);
  if (!Number.isNaN(existing) && existing >= 0 && existing <= 99) return existing;

  const bucket = Math.floor(Math.random() * 100);
  res.setHeader(
    "Set-Cookie",
    `${ROLLOUT_COOKIE}=${bucket}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`
  );
  return bucket;
}

// Applied to a release before it's shown on a public, anonymous page
// (share link or channel link) — NOT applied to the authenticated
// distribute page, where project members should always see their own
// releases regardless of these audience-facing gates.
export function isExpired(release) {
  return !!release.share_expires_at && new Date(release.share_expires_at) < new Date();
}

export function isRolledOut(release, req, res) {
  if (release.rollout_percent == null) return true;
  return getRolloutBucket(req, res) < release.rollout_percent;
}

export function needsPin(release) {
  return !!release.share_pin_hash;
}
