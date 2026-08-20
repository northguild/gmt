/**
 * Return a locale's AM/PM (day-period) labels as `[AM-label, PM-label]`.
 *
 * - Labels are locale-varying: `en-US` → `["AM", "PM"]`, `en-GB` →
 *   `["am", "pm"]`, `sv-SE` → `["fm", "em"]`, `zh-CN` → `["上午", "下午"]`,
 *   `ar-SA` → `["ص", "م"]`.
 * - Uses the host runtime's `Intl` data via `Intl.DateTimeFormat`, so output
 *   depends on the runtime's ICU build.
 * - Returns `[]` if `locale` is not a valid BCP 47 tag.
 *
 * @param locale BCP 47 locale tag (e.g. "en-US", "fr-FR", "ar-SA")
 * @returns 2-element `[AM-label, PM-label]` array, or `[]` on invalid input
 *
 * @example getLocaleMeridiems("en-US") // ["AM", "PM"]
 * @example getLocaleMeridiems("en-GB") // ["am", "pm"]
 * @example getLocaleMeridiems("zh-CN") // ["上午", "下午"]
 * @example getLocaleMeridiems("not-a-locale") // []
 */
export function getLocaleMeridiems(locale: string): string[] {
  if (typeof locale !== "string") return [];

  try {
    new Intl.Locale(locale);
  } catch {
    return [];
  }

  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      hour: "numeric",
      hour12: true,
    });
    const am =
      formatter
        .formatToParts(0)
        .find((part) => part.type === "dayPeriod")?.value ?? "";
    const pm =
      formatter
        .formatToParts(12 * 60 * 60 * 1000)
        .find((part) => part.type === "dayPeriod")?.value ?? "";
    return [am, pm];
  } catch {
    return [];
  }
}
