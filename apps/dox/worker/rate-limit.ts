import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_SECONDS,
} from "../src/lib/chat-constants";

interface RateLimitEntry {
  count: number;
  resetAt: number;
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
 * Map. Record this caveat wherever this limiter's behavior is described;
 * DOX-C.md's DoD requires the caveat be stated, not just the limiter exist.
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

export function checkRateLimit(clientId: string, now: number): RateLimitResult {
  sweepExpired(now);

  const existing = buckets.get(clientId);
  if (!existing || existing.resetAt <= now) {
    buckets.set(clientId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000,
    });
    return { allowed: true };
  }

  if (existing.count >= RATE_LIMIT_MAX) {
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
