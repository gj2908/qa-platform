// Reads a threshold override from `platform_settings` (edited from
// admin/pages/settings.js), falling back to the caller's hardcoded
// default if the row is missing — so an empty/unconfigured table changes
// nothing. Best-effort: a lookup failure also just returns the fallback.
export async function getSetting(service, key, fallback) {
  try {
    const { data } = await service.from("platform_settings").select("value").eq("key", key).maybeSingle();
    return data?.value ?? fallback;
  } catch (e) {
    return fallback;
  }
}
