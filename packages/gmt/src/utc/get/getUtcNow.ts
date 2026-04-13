import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current UTC instant as an ISO Instant string.
 *
 * - Uses `Temporal.Now.instant()` under the hood.
 * - Returns an empty string "" on unexpected failures.
 *
 * @returns ISO Instant string (e.g. "2024-02-29T00:00:00Z") or empty string
 */
export function getUtcNow(): string {
  try {
    return Temporal.Now.instant().toString();
  } catch {
    return "";
  }
}
