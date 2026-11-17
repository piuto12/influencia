/**
 * Two limiters with the same fixed-window semantics:
 *  - rateLimitShared(): Postgres-backed (table `rate_limits`, atomic upsert in rate_limit_hit()), shared by every serverless instance.
 *  - rateLimit(): in-memory, per instance. Used as the fallback if the database is unreachable, and in unit tests.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function resetRateLimits() { buckets.clear(); }

/** Shared limiter. Returns true when the request is allowed. Falls back to the in-memory limiter if the database call fails. */
export async function rateLimitShared(key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", { p_key: key, p_limit: limit, p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)) });
    if (error || typeof data !== "boolean") throw new Error(error?.message ?? "bad_response");
    return data;
  } catch {
    return rateLimit(key, limit, windowMs);
  }
}
