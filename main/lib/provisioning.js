const WARNING_THRESHOLD_DAYS = 14;

// provisioning_info is the jsonb blob stored on releases, shaped like
// analyzeIpa()'s `provisioning` return value (lib/ipaAnalyzer.js):
// { name, type, expirationDate (ISO string | null), deviceCount, ... }
// or { error } if parsing failed. iOS only — Android/web never set it.
// A build's profile expiring blocks installs regardless of provisioning
// type (Enterprise included), so this is evaluated independently of type.
export function getExpiryStatus(provisioningInfo) {
  const iso = provisioningInfo?.expirationDate;
  if (!iso) return null;

  const daysLeft = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  let status = "ok";
  if (daysLeft < 0) status = "expired";
  else if (daysLeft <= WARNING_THRESHOLD_DAYS) status = "expiring_soon";

  return { status, daysLeft, expirationDate: iso };
}
