// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { getLocaleFirstDayOfWeek } from "../../internal";
import { isValidDate } from "../validate";

/**
 * Return the start of the week containing `value`, using `locale`'s
 * first day of week (e.g. en-US: Sunday, fr-FR: Monday).
 *
 * - Resolves the locale's first day of week via
 *   `Intl.Locale.prototype.weekInfo`.
 * - Falls back to Monday if the runtime's `weekInfo` data doesn't resolve
 *   a first day for the locale.
 * - Distinct from `startOfDate(value, "week", { weekStartsOn })`, which
 *   takes an explicit ISO-biased `weekStartsOn` option instead of deriving
 *   it from a locale.
 * - Returns "" if `value` is invalid or `locale` is not a well-formed BCP 47 tag
 *   (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param value ISO 8601 date string
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns ""
 * @returns ISO 8601 date string for the start of `value`'s locale-relative week, or "" on invalid input
 *
 * @example getLocaleStartOfWeek("2024-02-29", "en-US") // "2024-02-25" (Sunday)
 * @example getLocaleStartOfWeek("2024-02-29", "fr-FR") // "2024-02-26" (Monday)
 * @example getLocaleStartOfWeek("invalid-date", "en-US") // ""
 * @example getLocaleStartOfWeek("2024-02-29", "not-a-locale-!!") // ""
 * @example getLocaleStartOfWeek("2024-05-15", ["en-US", "fr-FR"]) // "2024-05-12" (en-US, the first listed locale, starts weeks on Sunday)
 */
export function getLocaleStartOfWeek(
  value: string,
  locale: string | string[],
): string {
  if (!isValidDate(value)) return "";

  const firstDay = getLocaleFirstDayOfWeek(locale);
  if (firstDay === null) return "";

  try {
    const source = Temporal.PlainDate.from(value);
    const daysToSubtract = (source.dayOfWeek - firstDay + 7) % 7;
    return source.subtract({ days: daysToSubtract }).toString();
  } catch {
    return "";
  }
}
