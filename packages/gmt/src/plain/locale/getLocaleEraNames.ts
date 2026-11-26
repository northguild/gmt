import { eraNamesFor } from "../../internal/localeNames";
import type { LocaleNameStyle } from "./getLocaleMonthNames";

/**
 * Return a locale's Gregorian era names as [BCE-label, CE-label].
 *
 * - The two-element array is [Before Common Era label, Common Era label].
 * - Uses the host runtime's `Intl` data via `Intl.DateTimeFormat`, so output
 *   depends on the runtime's ICU build (full-ICU runtimes localize every
 *   locale; partial-ICU runtimes fall back to English).
 * - If a locale has no distinct BCE/CE era names, both array elements
 *   contain the same string — the function never returns a sentinel for
 *   a valid locale, only for invalid input.
 * - **A `-u-ca-` subtag in `locale` is ignored.** Both lookups pass `calendar: "gregory"` in the
 *   options bag, and ECMA-402's `ResolveLocale` ranks an options value above the locale
 *   extension, so ``getLocaleEraNames("th-TH-u-ca-buddhist")`` returns the same
 *   `["ปีก่อนคริสตกาล", "คริสต์ศักราช"]` as ``getLocaleEraNames("th-TH")``. That is deliberate — the function is Gregorian by
 *   contract — but it means the tag is accepted and overridden, not rejected. For another
 *   calendar's names, format a date in it: `formatDate("2024-03-15", "th-TH-u-ca-buddhist", { era: "long", year: "numeric" })`.
 * - Returns `[]` if `locale` is not a well-formed BCP 47 tag (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param locale BCP 47 locale tag (e.g. "fr-FR", "ar-SA", "en-US"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns []
 * @param style Optional name style: `"long"` (default), `"short"`, or `"narrow"`
 * @returns 2-element `[BCE-label, CE-label]` array, or `[]` on invalid input
 *
 * @example getLocaleEraNames("en-GB") // ["Before Christ", "Anno Domini"]
 * @example getLocaleEraNames("de-DE", "short") // ["v. Chr.", "n. Chr."]
 * @example getLocaleEraNames("ja-JP", "narrow") // ["BC", "AD"]
 * @example getLocaleEraNames("th-TH-u-ca-buddhist") // ["ปีก่อนคริสตกาล", "คริสต์ศักราช"] (the -u-ca- subtag is overridden)
 * @example getLocaleEraNames("not-a-locale-!!") // []
 * @example getLocaleEraNames(["fr-FR", "en-US"]) // ["avant Jésus-Christ", "après Jésus-Christ"]
 */
export function getLocaleEraNames(
  locale: string | string[],
  style: LocaleNameStyle = "long",
): string[] {
  return eraNamesFor(locale, style);
}
