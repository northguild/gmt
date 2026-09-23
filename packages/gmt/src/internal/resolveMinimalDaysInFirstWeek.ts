/**
 * The ISO 8601 minimal-days value: week 1 is the first week with at least 4 days in January.
 */
const ISO_MINIMAL_DAYS_IN_FIRST_WEEK = 4;

/**
 * Resolve the minimal-days-in-first-week rule for the locale week-year functions.
 *
 * - ECMA-402 does not expose a locale's `minimalDays`: `Intl.Locale.prototype.getWeekInfo` returns
 *   only `firstDay` and `weekend` (Intl Locale Info, WeekInfoOfLocale; the field was dropped in
 *   tc39/proposal-intl-locale-info#86). So the value comes from the caller, never the runtime.
 * - Omitted, it is the ISO 8601 value `4` on every runtime, so one input has one answer.
 * - Returns `null` for a value that is not an integer from 1 to 7 — the width of a week.
 *
 * @param options optional: minimalDays (integer 1–7)
 * @returns the minimal days to use, or null when `minimalDays` is out of range
 *
 * @example resolveMinimalDaysInFirstWeek() // 4
 * @example resolveMinimalDaysInFirstWeek({ minimalDays: 1 }) // 1
 * @example resolveMinimalDaysInFirstWeek({ minimalDays: 0 }) // null
 */
export function resolveMinimalDaysInFirstWeek(options?: {
  minimalDays?: number;
}): number | null {
  const minimalDays = options?.minimalDays;
  if (minimalDays === undefined) return ISO_MINIMAL_DAYS_IN_FIRST_WEEK;
  return Number.isInteger(minimalDays) && minimalDays >= 1 && minimalDays <= 7
    ? minimalDays
    : null;
}
