import { Temporal } from "@js-temporal/polyfill";
import { getLocaleFirstDayOfWeek } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return the locale-relative day-of-week index for `value`.
 *
 * - `0` = the locale's first day of week (e.g. Sunday for en-US, Monday for fr-FR).
 * - Resolves the locale's first day of week via `Intl.Locale.prototype.weekInfo`.
 * - Falls back to Monday if the runtime's `weekInfo` data doesn't resolve
 *   a first day for the locale.
 * - Returns `null` if `value` is not a valid ISO date or `locale` is unresolvable.
 *
 * @param value ISO 8601 date string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR")
 * @returns locale-relative day-of-week index (0–6) or null on invalid input
 *
 * @example getLocaleDayOfWeek("2024-02-25", "en-US") // 0 (Sunday)
 * @example getLocaleDayOfWeek("2024-02-26", "en-US") // 1 (Monday)
 * @example getLocaleDayOfWeek("2024-02-26", "fr-FR") // 0 (Monday)
 * @example getLocaleDayOfWeek("invalid-date", "en-US") // null
 * @example getLocaleDayOfWeek("2024-02-29", "not-a-locale") // null
 */
export function getLocaleDayOfWeek(
  value: string,
  locale: string,
): number | null {
  if (!isValidDate(value)) return null;

  const firstDay = getLocaleFirstDayOfWeek(locale);
  if (firstDay === null) return null;

  try {
    const date = Temporal.PlainDate.from(value);
    return (date.dayOfWeek - firstDay + 7) % 7;
  } catch {
    return null;
  }
}
