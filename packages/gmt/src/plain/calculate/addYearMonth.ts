import { moveYearMonth } from "../../internal/yearMonthArithmetic";

/**
 * Return a year-month string moved forward by `units`.
 *
 * - Takes years and months only: a year-month has no day, so `{ days: 1 }`, `{ weeks: 1 }` and the
 *   time units return `""`. An own `days`, `weeks` or time key returns `""` whatever its value
 *   (`{ months: 1, days: 0 }`): the misspelt-key guard. An inherited zero is no amount.
 * - The result is a year-month, so no day is clamped: `2024-02` plus a year is `2025-02`.
 * - A negative amount moves backward; mixed signs, fractions, a misspelt key, a non-number and no
 *   unit at all return `""`.
 * - The lowest year-month (`-271821-04`) cannot be moved, even by zero, and a result beyond
 *   `+275760-09` returns `""`.
 * - Accepts `YYYY-MM` and the forms `isValidYearMonth` accepts; the result is always `YYYY-MM`
 *   (`±YYYYYY-MM` outside 0000-9999).
 *
 * @param value year-month string
 * @param units the amounts to move the year-month by
 * @returns the year-month string after the addition, or "" on invalid input
 *
 * @example addYearMonth("2026-10", { months: 1 }) // "2026-11"
 * @example addYearMonth("2026-12", { months: 1 }) // "2027-01"
 * @example addYearMonth("2024-02", { years: 1 }) // "2025-02"
 * @example addYearMonth("2026-01", { months: -3 }) // "2025-10"
 * @example addYearMonth("2026-10", { days: 1 }) // ""
 * @example addYearMonth("2026-10", { months: 1, days: 0 }) // ""
 * @example addYearMonth("+275760-09", { months: 1 }) // ""
 */
export function addYearMonth(
  value: string,
  units: {
    /**
     * Whole years to add.
     *
     * @defaultValue no years; at least one of `years` and `months` must be given.
     */
    years?: number;
    /**
     * Whole months to add.
     *
     * @defaultValue no months; at least one of `years` and `months` must be given.
     */
    months?: number;
  },
): string {
  return moveYearMonth(value, units, "add");
}
