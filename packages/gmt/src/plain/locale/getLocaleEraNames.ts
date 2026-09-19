// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { resolveRequiredLocale } from "../../internal/resolveLocale";
import type { LocaleNameStyle } from "./getLocaleMonthNames";
// Imported from its module, not the `internal` barrel: `internal/patternToken.ts` imports this file.
import { zonedDateTimeFrom } from "../../internal/zonedWallClock";

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
 * - Returns `[]` if `locale` is not a well-formed BCP 47 tag (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR", "ar-SA"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns []
 * @param style Optional name style: `"long"` (default), `"short"`, or `"narrow"`
 * @returns 2-element `[BCE-label, CE-label]` array, or `[]` on invalid input
 *
 * @example getLocaleEraNames("en-US") // ["Before Christ", "Anno Domini"]
 * @example getLocaleEraNames("de-DE", "short") // ["v. Chr.", "n. Chr."]
 * @example getLocaleEraNames("ja-JP", "narrow") // ["BC", "AD"]
 * @example getLocaleEraNames("not-a-locale-!!") // []
 * @example getLocaleEraNames(["fr-FR", "en-US"]) // ["avant Jésus-Christ", "après Jésus-Christ"]
 */
export function getLocaleEraNames(
  locale: string | string[],
  style: LocaleNameStyle = "long",
): string[] {
  const resolvedLocale = resolveRequiredLocale(locale);
  if (resolvedLocale === null) return [];

  try {
    const resolved: "long" | "short" | "narrow" =
      style === "short" || style === "narrow" ? style : "long";

    const formatter = new Intl.DateTimeFormat(resolvedLocale, {
      calendar: "gregory",
      era: resolved,
      timeZone: "UTC",
    });

    // Year 1 BC (proleptic Gregorian) — Temporal represents 1 BC as year 0.
    const bceInstant = zonedDateTimeFrom({
      year: 0,
      month: 1,
      day: 1,
      hour: 12,
      timeZone: "UTC",
      calendar: "gregory",
    }).toInstant();

    // Year 1 AD (proleptic Gregorian).
    const ceInstant = zonedDateTimeFrom({
      year: 1,
      month: 1,
      day: 1,
      hour: 12,
      timeZone: "UTC",
      calendar: "gregory",
    }).toInstant();

    const bceParts = formatter.formatToParts(bceInstant.epochMilliseconds);
    const bceEra = bceParts.find((part) => part.type === "era")?.value ?? "";

    const ceParts = formatter.formatToParts(ceInstant.epochMilliseconds);
    const ceEra = ceParts.find((part) => part.type === "era")?.value ?? "";

    return [bceEra, ceEra];
  } catch {
    return [];
  }
}
