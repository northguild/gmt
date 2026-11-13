import { meridiemsFor } from "../../internal/localeNames";

/**
 * Return a locale's AM/PM (day-period) labels as `[AM-label, PM-label]`.
 *
 * - Labels are locale-varying: `en-GB` → `["am", "pm"]`, `zh-CN` →
 *   `["上午", "下午"]`, `ar-SA` → `["ص", "م"]`, `sv-SE` → `["fm", "em"]`,
 *   `en-US` → `["AM", "PM"]`.
 * - Uses the host runtime's `Intl` data via `Intl.DateTimeFormat`, so output
 *   depends on the runtime's ICU build.
 * - Returns `[]` if `locale` is not a well-formed BCP 47 tag (ECMA-402 `IsWellFormedLanguageTag`).
 *   A well-formed tag with no matching locale data is not an error: it falls back to the host's
 *   default locale, as ECMA-402 `ResolveLocale` requires.
 *
 * @param locale BCP 47 locale tag (e.g. "fr-FR", "ar-SA", "en-US"), or a preference list of tags (ECMA-402; the first with locale data is read). Required: omitted, or an empty list (which ECMA-402 would resolve to the host default), returns []
 * @returns 2-element `[AM-label, PM-label]` array, or `[]` on invalid input
 *
 * @example getLocaleMeridiems("ar-EG") // ["ص", "م"]
 * @example getLocaleMeridiems("en-GB") // ["am", "pm"]
 * @example getLocaleMeridiems("zh-CN") // ["上午", "下午"]
 * @example getLocaleMeridiems("not-a-locale-!!") // []
 * @example getLocaleMeridiems(["ja-JP", "en-US"]) // ["午前", "午後"]
 */
export function getLocaleMeridiems(locale: string | string[]): string[] {
  return meridiemsFor(locale);
}
