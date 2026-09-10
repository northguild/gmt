/**
 * DOX-C2 (#138) — the single seam rate-limit tests fake, rather than
 * reaching for a fake-timers library or letting `Date.now()` sprinkle
 * through the rate limiter directly.
 */
export function getUnixNowMs(): number {
  return Date.now();
}
