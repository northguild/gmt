import { Temporal } from "@js-temporal/polyfill";
import { getLocaleWeekendDays } from "../../internal";
import { isValidZonedDateTime } from "../validate";

/**
 * Return true when `value`'s local calendar day falls on a weekend for `locale`.
 *
 * - Uses `Intl.Locale.prototype.weekInfo` to resolve which ISO weekday
 *   numbers count as "weekend" for the locale (e.g. en-US: Sat/Sun,
 *   he-IL/ar-SA: Fri/Sat).
 * - Checks the ZonedDateTime's own local day of week — no separate timezone
 *   conversion needed, since `value` already carries its IANA timezone.
 * - Falls back to Saturday/Sunday if the runtime's `weekInfo` data doesn't
 *   resolve a weekend for the locale.
 * - Returns false if `value` or `locale` is invalid.
 *
 * @param value ISO ZonedDateTime string
 * @param locale BCP 47 locale tag (e.g. "en-US", "he-IL")
 * @returns true if `value`'s local day is a weekend day in `locale`, false on invalid input
 *
 * @example isZonedWeekend("2024-02-03T10:00:00-05:00[America/New_York]", "en-US") // true (Saturday)
 * @example isZonedWeekend("2024-02-02T10:00:00+02:00[Asia/Jerusalem]", "he-IL") // true (Friday, he-IL weekend is Fri/Sat)
 * @example isZonedWeekend("2024-02-04T10:00:00+02:00[Asia/Jerusalem]", "he-IL") // false (Sunday)
 * @example isZonedWeekend("invalid", "en-US") // false
 * @example isZonedWeekend("2024-02-03T10:00:00-05:00[America/New_York]", "not-a-locale") // false
 */
export function isZonedWeekend(value: string, locale: string): boolean {
  if (!isValidZonedDateTime(value)) return false;

  const weekendDays = getLocaleWeekendDays(locale);
  if (!weekendDays) return false;

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return weekendDays.has(zonedDateTime.dayOfWeek);
  } catch {
    return false;
  }
}
