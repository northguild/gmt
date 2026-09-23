import { resolveRequiredLocale } from "../../internal/resolveLocale";
/**
 * Return a locale's AM/PM (day-period) labels as `[AM-label, PM-label]`.
 *
 * - Labels are locale-varying: `en-US` → `["AM", "PM"]`, `en-GB` →
 *   `["am", "pm"]`, `sv-SE` → `["fm", "em"]`, `zh-CN` → `["上午", "下午"]`,
 *   `ar-SA` → `["ص", "م"]`.
 * - Uses the host runtime's `Intl` data via `Intl.DateTimeFormat`, so output
 *   depends on the runtime's ICU build.
 * - Returns `[]` if `locale` is not a well-formed BCP 47 tag (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR", "ar-SA"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns []
 * @returns 2-element `[AM-label, PM-label]` array, or `[]` on invalid input
 *
 * @example getLocaleMeridiems("en-US") // ["AM", "PM"]
 * @example getLocaleMeridiems("en-GB") // ["am", "pm"]
 * @example getLocaleMeridiems("zh-CN") // ["上午", "下午"]
 * @example getLocaleMeridiems("not-a-locale-!!") // []
 * @example getLocaleMeridiems(["ja-JP", "en-US"]) // ["午前", "午後"]
 */
export function getLocaleMeridiems(locale: string | string[]): string[] {
  try {
    const resolvedLocale = resolveRequiredLocale(locale);
    if (resolvedLocale === null) return [];

    try {
      const formatter = new Intl.DateTimeFormat(resolvedLocale, {
        timeZone: "UTC",
        hour: "numeric",
        hour12: true,
      });
      const am =
        formatter.formatToParts(0).find((part) => part.type === "dayPeriod")
          ?.value ?? "";
      const pm =
        formatter
          .formatToParts(12 * 60 * 60 * 1000)
          .find((part) => part.type === "dayPeriod")?.value ?? "";
      return [am, pm];
    } catch {
      return [];
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
