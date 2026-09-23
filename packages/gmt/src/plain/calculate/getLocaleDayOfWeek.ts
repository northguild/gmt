// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
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
 * - Returns `null` if `value` is not a valid ISO date or `locale` is not a well-formed BCP 47 tag
 *   (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param value ISO 8601 date string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns null
 * @returns locale-relative day-of-week index (0–6) or null on invalid input
 *
 * @example getLocaleDayOfWeek("2024-02-25", "en-US") // 0 (Sunday)
 * @example getLocaleDayOfWeek("2024-02-26", "en-US") // 1 (Monday)
 * @example getLocaleDayOfWeek("2024-02-26", "fr-FR") // 0 (Monday)
 * @example getLocaleDayOfWeek("invalid-date", "en-US") // null
 * @example getLocaleDayOfWeek("2024-02-29", "not-a-locale-!!") // null
 * @example getLocaleDayOfWeek("2024-05-15", ["en-US", "fr-FR"]) // 3 (Wednesday in a Sunday-first week)
 */
export function getLocaleDayOfWeek(
  value: string,
  locale: string | string[],
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
