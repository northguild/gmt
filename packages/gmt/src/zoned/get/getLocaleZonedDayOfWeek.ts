import { Temporal } from "@js-temporal/polyfill";
import { getLocaleFirstDayOfWeek } from "../../internal";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the locale-relative day-of-week index for a zoned `value`.
 *
 * - `0` = the locale's first day of week (e.g. Sunday for en-US, Monday for fr-FR).
 * - Resolves the locale's first day of week via `Intl.Locale.prototype.weekInfo`.
 * - Falls back to Monday if the runtime's `weekInfo` data doesn't resolve
 *   a first day for the locale.
 * - Returns `null` if `value` is not a valid zoned ISO datetime or `locale` is unresolvable.
 *
 * @param value zoned ISO 8601 datetime string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR")
 * @returns locale-relative day-of-week index (0–6) or null on invalid input
 *
 * @example getLocaleZonedDayOfWeek("2024-02-25T12:00:00+00:00[UTC]", "en-US") // 0 (Sunday)
 * @example getLocaleZonedDayOfWeek("2024-02-26T12:00:00+00:00[UTC]", "en-US") // 1 (Monday)
 * @example getLocaleZonedDayOfWeek("2024-02-26T12:00:00+00:00[UTC]", "fr-FR") // 0 (Monday)
 * @example getLocaleZonedDayOfWeek("invalid-zoned", "en-US") // null
 * @example getLocaleZonedDayOfWeek("2024-02-26T12:00:00+00:00[UTC]", "not-a-locale") // null
 */
export function getLocaleZonedDayOfWeek(
  value: string,
  locale: string,
): number | null {
  if (!isValidZonedDateTime(value)) return null;

  const firstDay = getLocaleFirstDayOfWeek(locale);
  if (firstDay === null) return null;

  try {
    const zoned = Temporal.ZonedDateTime.from(value);
    return (zoned.dayOfWeek - firstDay + 7) % 7;
  } catch {
    return null;
  }
}
