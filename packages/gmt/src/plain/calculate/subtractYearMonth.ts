import { moveYearMonth } from "../../internal/yearMonthArithmetic";

/**
 * Return a year-month string moved backward by `units`.
 *
 * - The same rules as `addYearMonth`: years and months only (`{ days: 1 }` and `{ weeks: 1 }`
 *   return `""`), nothing to clamp, and `""` for invalid input.
 * - The amounts are not negated here, so the sign rules (mixed signs, `-0`) are Temporal's.
 * - The subtraction starts from day 1 of the month, as the specification's
 *   AddDurationToYearMonth does with operation `subtract` (it negates the duration, then sets
 *   [[Day]] to 1), so `+275760-09` minus a month is `+275760-08` and
 *   `-271821-05` minus a month is `""` (day 1 of `-271821-04` is out of range).
 *
 * @param value year-month string
 * @param units the amounts to move the year-month by
 * @returns the year-month string after the subtraction, or "" on invalid input
 *
 * @example subtractYearMonth("2026-10", { months: 10 }) // "2025-12"
 * @example subtractYearMonth("2026-03", { years: 1, months: 4 }) // "2024-11"
 * @example subtractYearMonth("+275760-09", { months: 1 }) // "+275760-08"
 * @example subtractYearMonth("-271821-05", { months: 1 }) // ""
 * @example subtractYearMonth("2026-10", { weeks: 1 }) // ""
 */
export function subtractYearMonth(
  value: string,
  units: {
    /**
     * Whole years to subtract.
     *
     * @defaultValue no years; at least one of `years` and `months` must be given.
     */
    years?: number;
    /**
     * Whole months to subtract.
     *
     * @defaultValue no months; at least one of `years` and `months` must be given.
     */
    months?: number;
  },
): string {
  return moveYearMonth(value, units, "subtract");
}
