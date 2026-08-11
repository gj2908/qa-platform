import crypto from "crypto";

const PREFIX = "qap_";

// Raw tokens are never stored — only a SHA-256 hash, plus a short prefix
// for identifying a token in the UI (like GitHub/Stripe PATs).
export function generateToken() {
  const raw = PREFIX + crypto.randomBytes(16).toString("hex");
  return { raw, hash: hashToken(raw), prefix: raw.slice(0, 12) };
}

export function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
