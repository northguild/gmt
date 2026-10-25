import type { YearMonth } from "./nonIsoArithmetic";

/*
 * Month arithmetic in a calendar whose every year has the same number of months: the two integer
 * month questions of the arithmetic model, answered in constant time from the month count alone.
 * `readArithmeticModel.ts` uses it where the polyfill's own month arithmetic cannot be asked (D18),
 * with the count read from the runtime (`largeMonthSpan.ts`), so GMT states no calendar rule.
 */

/** `BalanceNonISODate(start.year, start.month + months, 1)` for `monthsPerYear` months in every year. */
export function addFixedMonths(
  start: YearMonth,
  months: number,
  monthsPerYear: number,
): YearMonth {
  const ordinal = start.month - 1 + months;
  const years = Math.floor(ordinal / monthsPerYear);
  return {
    year: start.year + years,
    month: ordinal - years * monthsPerYear + 1,
  };
}

/** The signed month count from `from` to `to` for `monthsPerYear` months in every year. */
export function fixedMonthsBetween(
  from: YearMonth,
  to: YearMonth,
  monthsPerYear: number,
): number {
  return (to.year - from.year) * monthsPerYear + (to.month - from.month);
}
