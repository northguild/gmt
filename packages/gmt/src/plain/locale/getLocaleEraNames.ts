import { Temporal } from "@js-temporal/polyfill";
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
 * - Returns `[]` if `locale` is not a valid BCP 47 tag.
 *
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR", "ar-SA")
 * @param style Optional name style: `"long"` (default), `"short"`, or `"narrow"`
 * @returns 2-element `[BCE-label, CE-label]` array, or `[]` on invalid input
 *
 * @example getLocaleEraNames("en-US") // ["Before Christ", "Anno Domini"]
 * @example getLocaleEraNames("de-DE", "short") // ["v. Chr.", "n. Chr."]
 * @example getLocaleEraNames("ja-JP", "narrow") // ["BC", "AD"]
 * @example getLocaleEraNames("not-a-locale") // []
 */
export function getLocaleEraNames(
  locale: string,
  style: LocaleNameStyle = "long",
): string[] {
  if (typeof locale !== "string") return [];

  try {
    new Intl.Locale(locale);
  } catch {
    return [];
  }

  try {
    const resolved: "long" | "short" | "narrow" =
      style === "short" || style === "narrow" ? style : "long";

    const formatter = new Intl.DateTimeFormat(locale, {
      calendar: "gregory",
      era: resolved,
      timeZone: "UTC",
    });

    // Year 1 BC (proleptic Gregorian) — Temporal represents 1 BC as year 0.
    const bceInstant = Temporal.ZonedDateTime.from({
      year: 0,
      month: 1,
      day: 1,
      hour: 12,
      timeZone: "UTC",
      calendar: "gregory",
    }).toInstant();

    // Year 1 AD (proleptic Gregorian).
    const ceInstant = Temporal.ZonedDateTime.from({
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
