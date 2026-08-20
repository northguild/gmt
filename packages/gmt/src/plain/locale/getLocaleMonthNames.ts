import { Temporal } from "@js-temporal/polyfill";

/**
 * The calendar-name styles supported by GMT's locale name lookups.
 *
 * These mirror the `month`/`weekday` options of `Intl.DateTimeFormat`
 * rather than inventing a GMT-specific vocabulary.
 */
export type LocaleNameStyle = "long" | "short" | "narrow";

/**
 * Return the 12 Gregorian calendar-month names for a locale, in calendar
 * order (January first, December last — not alphabetical).
 *
 * - Uses the host runtime's `Intl` data via `Temporal.PlainDate`, so output
 *   depends on the runtime's ICU build (full-ICU runtimes localize every
 *   locale; partial-ICU runtimes fall back to English).
 * - Restricted to the Gregorian calendar; non-Gregorian calendar variants
 *   are out of scope for this function.
 * - Returns `[]` if `locale` is not a valid BCP 47 tag.
 *
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR", "ar-SA")
 * @param style Optional name style: `"long"` (default), `"short"`, or `"narrow"`
 * @returns 12-element array of month names in calendar order, or `[]` on invalid input
 *
 * @example getLocaleMonthNames("en-US") // ["January", "February", ... "December"]
 * @example getLocaleMonthNames("de-DE", "short") // ["Jan", "Feb", "Mär", ... "Dez"]
 * @example getLocaleMonthNames("fr-FR", "narrow") // ["J", "F", "M", ... "D"]
 * @example getLocaleMonthNames("not-a-locale") // []
 */
export function getLocaleMonthNames(
  locale: string,
  style: LocaleNameStyle = "long",
): string[] {
  if (typeof locale !== "string") return [];

  try {
    // Validate the BCP 47 tag; `Intl.Locale` throws on a syntactically
    // invalid tag, which we map to the array sentinel.
    new Intl.Locale(locale);
  } catch {
    return [];
  }

  try {
    const resolved: "long" | "short" | "narrow" =
      style === "short" || style === "narrow" ? style : "long";
    const names: string[] = [];
    for (let month = 1; month <= 12; month++) {
      const date = Temporal.PlainDate.from(
        `2024-${String(month).padStart(2, "0")}-15`,
      );
      names.push(
        date.toLocaleString(locale, { month: resolved, calendar: "gregory" }),
      );
    }
    return names;
  } catch {
    return [];
  }
}
