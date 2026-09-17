import { resolveRequiredLocale } from "../../internal/resolveLocale";
import { Temporal } from "@js-temporal/polyfill";
import { getLocaleFirstDayOfWeek } from "../../internal/getLocaleFirstDayOfWeek";
import type { LocaleNameStyle } from "./getLocaleMonthNames";

/**
 * Return the 7 weekday names for a locale, ordered starting from the
 * locale's first day of the week.
 *
 * - For `en-US` the array starts with Sunday; for `fr-FR` it starts with
 *   Monday; for `ar-SA` it starts with Saturday — matching GMT's existing
 *   locale-first-day convention in `getLocaleDayOfWeek` / `getLocaleStartOfWeek`.
 * - This ordering is consistent with `getLocaleDayOfWeek`: for any valid
 *   date, `getLocaleWeekdayNames(locale)[getLocaleDayOfWeek(date, locale)]`
 *   is that date's localized weekday name.
 * - Uses the host runtime's `Intl` data via `Temporal.PlainDate`, so output
 *   depends on the runtime's ICU build.
 * - Returns `[]` if `locale` is not a well-formed BCP 47 tag (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR", "ar-SA"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns []
 * @param style Optional name style: `"long"` (default), `"short"`, or `"narrow"`
 * @returns 7-element array of weekday names from the locale's first day, or `[]` on invalid input
 *
 * @example getLocaleWeekdayNames("en-US") // ["Sunday", "Monday", ... "Saturday"]
 * @example getLocaleWeekdayNames("fr-FR") // ["lundi", "mardi", ... "dimanche"]
 * @example getLocaleWeekdayNames("de-DE", "short") // ["Mo", "Di", "Mi", ... "So"]
 * @example getLocaleWeekdayNames("not-a-locale-!!") // []
 * @example getLocaleWeekdayNames(["fr-FR", "en-US"]) // ["lundi", "mardi", …, "dimanche"]
 */
export function getLocaleWeekdayNames(
  locale: string | string[],
  style: LocaleNameStyle = "long",
): string[] {
  const resolvedLocale = resolveRequiredLocale(locale);
  if (resolvedLocale === null) return [];

  const firstDay = getLocaleFirstDayOfWeek(resolvedLocale);
  if (firstDay === null) return [];

  try {
    const resolved: "long" | "short" | "narrow" =
      style === "short" || style === "narrow" ? style : "long";
    // Build the names in ISO order (Monday-first), then rotate so the
    // locale's first day of week sits at index 0.
    const isoOrder: string[] = [];
    for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
      const date = Temporal.PlainDate.from("2024-01-15").add({
        days: dayOfWeek - 1,
      });
      isoOrder.push(date.toLocaleString(resolvedLocale, { weekday: resolved }));
    }
    return isoOrder.slice(firstDay - 1).concat(isoOrder.slice(0, firstDay - 1));
  } catch {
    return [];
  }
}
