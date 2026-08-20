import { Temporal } from "@js-temporal/polyfill";
import { getLocaleFirstDayOfWeek } from "../../internal";
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
 * - Returns `[]` if `locale` is not a valid BCP 47 tag.
 *
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR", "ar-SA")
 * @param style Optional name style: `"long"` (default), `"short"`, or `"narrow"`
 * @returns 7-element array of weekday names from the locale's first day, or `[]` on invalid input
 *
 * @example getLocaleWeekdayNames("en-US") // ["Sunday", "Monday", ... "Saturday"]
 * @example getLocaleWeekdayNames("fr-FR") // ["lundi", "mardi", ... "dimanche"]
 * @example getLocaleWeekdayNames("de-DE", "short") // ["Mo", "Di", "Mi", ... "So"]
 * @example getLocaleWeekdayNames("not-a-locale") // []
 */
export function getLocaleWeekdayNames(
  locale: string,
  style: LocaleNameStyle = "long",
): string[] {
  if (typeof locale !== "string") return [];

  const firstDay = getLocaleFirstDayOfWeek(locale);
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
      isoOrder.push(date.toLocaleString(locale, { weekday: resolved }));
    }
    return isoOrder.slice(firstDay - 1).concat(isoOrder.slice(0, firstDay - 1));
  } catch {
    return [];
  }
}
