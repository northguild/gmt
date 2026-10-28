/**
 * Whether `unit` is a duration unit a year-month takes: `"years"` or `"months"`. This is the set
 * AddDurationToYearMonth leaves after it rejects nonzero weeks, days and time units.
 *
 * @param unit the candidate key
 * @returns whether it is `"years"` or `"months"`
 *
 * @example isYearMonthDurationUnit("months") // true
 * @example isYearMonthDurationUnit("days") // false
 */
export function isYearMonthDurationUnit(
  unit: string,
): unit is "years" | "months" {
  return unit === "years" || unit === "months";
}
