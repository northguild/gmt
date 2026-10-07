import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current UTC instant as an ISO Instant string.
 *
 * - Uses Temporal.Now.instant() to get current UTC time.
 *
 * @returns ISO Instant string (e.g. "2024-02-29T00:00:00Z")
 *
 * @example getUtcNow() // "2024-02-29T00:00:00Z"
 */
export function getUtcNow(): string {
  return Temporal.Now.instant().toString();
}
