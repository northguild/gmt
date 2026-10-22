interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** How many requests one key may make, and the length of the window that counts them. */
export interface RateLimitPolicy {
  max: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * DOX-C2 (#138) — per-isolate, not global. A `Map` at module scope is
 * blunt-instrument abuse protection: it stops a casual script hammering
 * `/api/chat` from one isolate, and nothing more. It does **not** stop a
 * determined attacker spread across Cloudflare's many isolates/colos. If
 * real global limits are needed later, the upgrade paths are Cloudflare
 * WAF/Rate Limiting rules, Turnstile, or a Durable Object — not a bigger
 * Map. State this caveat wherever the limiter is described — calling Dox
 * "rate limited" without it overclaims.
 */
const buckets = new Map<string, RateLimitEntry>();

/** Opportunistic sweep — Workers have no persistent background timer, so
 * expired entries are only ever cleared as a side effect of a real request
 * checking the map, not on a schedule. */
function sweepExpired(now: number): void {
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

/**
 * `key` names the bucket, so two callers sharing a client never share a count: chat passes
 * `chat:<clientId>`, the Canada checker `canada:<clientId>`.
 */
export function checkRateLimit(
  key: string,
  now: number,
  policy: RateLimitPolicy,
): RateLimitResult {
  sweepExpired(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + policy.windowSeconds * 1000,
    });
    return { allowed: true };
  }

  if (existing.count >= policy.max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { allowed: true };
}

/** Test-only: the module-scope map otherwise leaks state across test cases
 * within the same file/worker isolate. */
export function resetRateLimitState(): void {
  buckets.clear();
}

export function clientIdFromRequest(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}
