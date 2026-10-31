import { nowInstant } from "../../internal/temporalCompat";

/**
 * Return the current UTC instant as an ISO Instant string.
 *
 * - Uses nowInstant() to get current UTC time.
 *
 * @returns ISO Instant string (e.g. "2024-02-29T00:00:00Z")
 *
 * @example getUtcNow() // "2024-02-29T00:00:00Z"
 */
export function getUtcNow(): string {
  return nowInstant().toString();
}
