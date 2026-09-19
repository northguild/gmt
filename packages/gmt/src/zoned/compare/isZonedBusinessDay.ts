import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";

/**
 * Return true when `value` falls on a Monday–Friday ISO business day in the given timezone.
 *
 * - Uses the fixed ISO Monday–Friday business-day boundary (Mon=1 … Fri=5),
 *   matching the definition used by `addZonedBusinessDays`/`subtractZonedBusinessDays`.
 * - Locale-agnostic: no `Intl.Locale` lookup and no holiday calendar.
 * - Returns false if `value` is invalid.
 *
 * - Resolves the local day in the value's own timezone, so a UTC instant that is
 *   Friday evening may be Saturday morning in `Asia/Tokyo` and thus not a business
 *   day there.
 * - Has no calendar parameter: the weekend is always Saturday–Sunday. It is not
 *   the zoned form of the plain `isBusinessDay`, which takes a `BusinessCalendar`
 *   (weekend days, holidays). For a Friday–Saturday weekend or holidays, convert
 *   to a plain date and call `isBusinessDay` with a calendar.
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
    const zoned = zonedDateTimeFrom(value);
    return zoned.dayOfWeek >= 1 && zoned.dayOfWeek <= 5;
  } catch {
    return false;
  }
}
