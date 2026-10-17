// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { resolveRequiredLocale } from "../../internal/resolveLocale";
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
 * - **A `-u-ca-` subtag in `locale` is ignored.** Both lookups pass `calendar: "gregory"` in the
 *   options bag, and ECMA-402's `ResolveLocale` ranks an options value above the locale
 *   extension, so ``getLocaleMonthNames("hi-IN-u-ca-indian")`` returns the same
 *   twelve Gregorian month names as ``getLocaleMonthNames("hi-IN")``. That is deliberate — the function is Gregorian by
 *   contract — but it means the tag is accepted and overridden, not rejected. For another
 *   calendar's names, format a date in it: `formatDate("2024-03-15", "hi-IN-u-ca-indian", { month: "long" })`.
 * - Returns `[]` if `locale` is not a well-formed BCP 47 tag (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param locale BCP 47 locale tag (e.g. "fr-FR", "ar-SA", "en-US"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns []
 * @param style Optional name style: `"long"` (default), `"short"`, or `"narrow"`
 * @returns 12-element array of month names in calendar order, or `[]` on invalid input
 *
 * @example getLocaleMonthNames("ja-JP") // ["1月", "2月", ... "12月"]
 * @example getLocaleMonthNames("de-DE", "short") // ["Jan", "Feb", "Mär", ... "Dez"]
 * @example getLocaleMonthNames("fr-FR", "narrow") // ["J", "F", "M", ... "D"]
 * @example getLocaleMonthNames("hi-IN-u-ca-indian") // ["जनवरी", "फ़रवरी", ... "दिसंबर"] (the -u-ca- subtag is overridden)
 * @example getLocaleMonthNames("not-a-locale-!!") // []
 * @example getLocaleMonthNames(["fr-FR", "en-US"]) // ["janvier", "février", …, "décembre"]
 */
export function getLocaleMonthNames(
  locale: string | string[],
  style: LocaleNameStyle = "long",
): string[] {
  try {
    const resolvedLocale = resolveRequiredLocale(locale);
    if (resolvedLocale === null) return [];

    try {
      const resolved: "long" | "short" | "narrow" =
        style === "short" || style === "narrow" ? style : "long";
      const names: string[] = [];
      for (let month = 1; month <= 12; month++) {
        const date = Temporal.PlainDate.from(
          `2024-${String(month).padStart(2, "0")}-15`,
        );
        names.push(
          date.toLocaleString(resolvedLocale, {
            month: resolved,
            calendar: "gregory",
          }),
        );
      }
      return names;
    } catch {
      return [];
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
