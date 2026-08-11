import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return true when `value` falls on a Monday–Friday ISO business day in the given timezone.
 *
 * - Uses the fixed ISO Monday–Friday business-day boundary (Mon=1 … Fri=5),
 *   matching the definition used by `addZonedBusinessDays`/`subtractZonedBusinessDays`.
 * - Locale-agnostic: no `Intl.Locale` lookup and no holiday calendar.
 * - Returns false if `value` is invalid.
 *
 * This is the timezone-aware complement to the plain `isBusinessDay`: both use
 * ISO Mon–Fri, but `isZonedBusinessDay` resolves the local day in the given
 * timezone (so a UTC instant that is Friday evening may be Saturday morning
 * in `Asia/Tokyo` and thus not a business day there).
 *
 * @param value ISO 8601 zoned datetime string
 * @returns true if `value` is a Monday–Friday business day, false on invalid input
 *
 * @example isZonedBusinessDay("2024-02-05T10:00:00-05:00[America/New_York]") // true (Monday)
 * @example isZonedBusinessDay("2024-02-10T10:00:00-05:00[America/New_York]") // false (Saturday)
 * @example isZonedBusinessDay("2024-02-04T10:00:00-05:00[America/New_York]") // false (Sunday)
 * @example isZonedBusinessDay("invalid") // false
 */
export function isZonedBusinessDay(value: string): boolean {
  if (!isValidZonedDateTime(value)) return false;

  try {
    const zoned = Temporal.ZonedDateTime.from(value);
    return zoned.dayOfWeek >= 1 && zoned.dayOfWeek <= 5;
  } catch {
    return false;
  }
}
