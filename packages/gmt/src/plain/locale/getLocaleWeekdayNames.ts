import { weekdayNamesFor } from "../../internal/localeNames";
import type { LocaleNameStyle } from "./getLocaleMonthNames";

/**
 * Return the 7 weekday names for a locale, ordered starting from the
 * locale's first day of the week.
 *
 * - The order is the locale's **first day of the week**, never its weekend. For `pt-BR` and
 *   `ar-SA` the array starts with Sunday, for `fr-FR` with Monday, for `ar-EG` with Saturday —
 *   matching GMT's existing locale-first-day convention in `getLocaleDayOfWeek` /
 *   `getLocaleStartOfWeek`. `ar-SA`'s weekend is Friday and Saturday
 *   (`new Intl.Locale("ar-SA").getWeekInfo()` is `{ firstDay: 7, weekend: [5, 6] }`), but its week
 *   still begins on Sunday; a locale's weekend says nothing about where its week starts.
 * - This ordering is consistent with `getLocaleDayOfWeek`: for any valid
 *   date, `getLocaleWeekdayNames(locale)[getLocaleDayOfWeek(date, locale)]`
 *   is that date's localized weekday name.
 * - Uses the host runtime's `Intl` data via `Temporal.PlainDate`, so output
 *   depends on the runtime's ICU build.
 * - Returns `[]` if `locale` is not a well-formed BCP 47 tag (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param locale BCP 47 locale tag (e.g. "fr-FR", "ar-SA", "en-US"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns []
 * @param style Optional name style: `"long"` (default), `"short"`, or `"narrow"`
 * @returns 7-element array of weekday names from the locale's first day, or `[]` on invalid input
 *
 * @example getLocaleWeekdayNames("pt-BR") // ["domingo", "segunda-feira", ... "sábado"]
 * @example getLocaleWeekdayNames("fr-FR") // ["lundi", "mardi", ... "dimanche"]
 * @example getLocaleWeekdayNames("de-DE", "short") // ["Mo", "Di", "Mi", ... "So"]
 * @example getLocaleWeekdayNames("ar-EG")[0] // "السبت" (Saturday — ar-EG's first day, unlike ar-SA's Sunday)
 * @example getLocaleWeekdayNames("not-a-locale-!!") // []
 * @example getLocaleWeekdayNames(["fr-FR", "en-US"]) // ["lundi", "mardi", …, "dimanche"]
 */
export function getLocaleWeekdayNames(
  locale: string | string[],
  style: LocaleNameStyle = "long",
): string[] {
  return weekdayNamesFor(locale, style);
}
