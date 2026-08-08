import { Temporal } from "@js-temporal/polyfill";
import { getLocaleFirstDayOfWeek } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return the end of the week containing `value`, using `locale`'s first
 * day of week (e.g. en-US: week ends Saturday, fr-FR: week ends Sunday).
 *
 * - Resolves the locale's first day of week via
 *   `Intl.Locale.prototype.weekInfo`.
 * - Falls back to Monday-start (so the week ends Sunday) if the runtime's
 *   `weekInfo` data doesn't resolve a first day for the locale.
 * - Distinct from `endOfDate(value, "week", { weekStartsOn })`, which
 *   takes an explicit ISO-biased `weekStartsOn` option instead of deriving
 *   it from a locale.
 * - Returns "" if `value` or `locale` is invalid.
 *
 * @param value ISO 8601 date string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR")
 * @returns ISO 8601 date string for the end of `value`'s locale-relative week, or "" on invalid input
 *
 * @example getLocaleEndOfWeek("2024-02-29", "en-US") // "2024-03-02" (Saturday)
 * @example getLocaleEndOfWeek("2024-02-29", "fr-FR") // "2024-03-03" (Sunday)
 * @example getLocaleEndOfWeek("invalid-date", "en-US") // ""
 * @example getLocaleEndOfWeek("2024-02-29", "not-a-locale") // ""
 */
export function getLocaleEndOfWeek(value: string, locale: string): string {
  if (!isValidDate(value)) return "";

  const firstDay = getLocaleFirstDayOfWeek(locale);
  if (firstDay === null) return "";

  try {
    const source = Temporal.PlainDate.from(value);
    const daysToSubtract = (source.dayOfWeek - firstDay + 7) % 7;
    return source.add({ days: 6 - daysToSubtract }).toString();
  } catch {
    return "";
  }
}
