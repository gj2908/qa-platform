// DB-backed rate limiting for the anonymous public endpoints — a row per
// attempt in `rate_limit_events`, keyed by "<endpoint>:<ip-or-email>".
// No Redis/queue infra exists in this app, so a count-in-window query
// against Postgres is consistent with its existing patterns.
export async function checkRateLimit(service, key, { maxAttempts, windowMinutes }) {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { count } = await service
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", windowStart);

  if ((count || 0) >= maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  await service.from("rate_limit_events").insert({ key });
  return { allowed: true, remaining: maxAttempts - (count || 0) - 1 };
}

export function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}
