import { isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";

/**
 * Return true when `value` falls on a Monday–Friday business day in the given timezone.
 *
 * - Uses a fixed Monday–Friday business week (ISO weekday numbers 1 … 5), matching
 *   `addZonedBusinessDays`/`subtractZonedBusinessDays`. Saturday–Sunday is CLDR's
 *   world-default weekend; ISO 8601 numbers the weekdays but defines no weekend.
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
 * @example isZonedBusinessDay("2024-02-05T10:00:00+05:30[Asia/Kolkata]") // true (Monday)
 * @example isZonedBusinessDay("2024-02-10T10:00:00+05:30[Asia/Kolkata]") // false (Saturday)
 * @example isZonedBusinessDay("2024-02-04T10:00:00+05:30[Asia/Kolkata]") // false (Sunday)
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
