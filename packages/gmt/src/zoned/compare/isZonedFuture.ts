import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return true when `value` represents an instant strictly after now.
 *
 * - Unlike the plain `isFuture`, which compares calendar days, this compares
 *   the exact instant `value` represents against `Temporal.Now.instant()` —
 *   `value` carries a full time-of-day, not just a date.
 * - `value === now` (to the precision available) returns false — "future"
 *   means strictly after, not on-or-after.
 * - Returns false if `value` is invalid.
 *
 * @param value ISO ZonedDateTime string
 * @returns true if `value` is after the current instant, false on invalid input
 *
 * @example isZonedFuture("2999-01-01T00:00:00Z[UTC]") // true (an instant in the distant future)
 * @example isZonedFuture("2020-01-01T00:00:00Z[UTC]") // false (an instant in the distant past)
 * @example isZonedFuture("invalid") // false
 */
export function isZonedFuture(value: string): boolean {
  if (!isValidZonedDateTime(value)) {
    return false;
  }

  try {
    const instant = Temporal.ZonedDateTime.from(value).toInstant();
    return Temporal.Instant.compare(instant, Temporal.Now.instant()) === 1;
  } catch {
    return false;
  }
}
