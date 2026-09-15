import { Temporal } from "@js-temporal/polyfill";

/** `fixedFromIso(1970, 1, 1)`. */
const UNIX_EPOCH_FIXED_DAY = 719_163;

/**
 * Floored integer division remainder: the result has the sign of `divisor` (`mod(-1, 19)` is 18),
 * as the calendar formulas below require. JS `%` keeps the dividend's sign.
 */
export function mod(value: number, divisor: number): number {
  return value - divisor * Math.floor(value / divisor);
}

/** Proleptic Gregorian (ISO 8601) leap year. */
export function isIsoLeapYear(year: number): boolean {
  return mod(year, 4) === 0 && (mod(year, 100) !== 0 || mod(year, 400) === 0);
}

/**
 * The fixed day number (R.D.; 0001-01-01 is day 1) of a proleptic Gregorian date, per
 * Dershowitz & Reingold, *Calendrical Calculations* (3rd ed.), §2.2 `fixed-from-gregorian`.
 * Pure integer arithmetic, so it also works for dates outside the Temporal PlainDate range, which
 * the calendar arithmetic needs for year boundaries next to the minimum.
 *
 * @example fixedFromIso(1, 1, 1) // 1
 * @example fixedFromIso(1970, 1, 1) // 719163
 */
export function fixedFromIso(year: number, month: number, day: number): number {
  const prior = year - 1;
  const monthAdjustment = month <= 2 ? 0 : isIsoLeapYear(year) ? -1 : -2;
  return (
    365 * prior +
    Math.floor(prior / 4) -
    Math.floor(prior / 100) +
    Math.floor(prior / 400) +
    Math.floor((367 * month - 362) / 12) +
    monthAdjustment +
    day
  );
}

/**
 * The ISO-calendared PlainDate of a fixed day number. Throws RangeError outside the TC39 PlainDate
 * range (`ISODateWithinLimits`), through ISO day arithmetic.
 *
 * @example dateFromFixed(719163).toString() // "1970-01-01"
 */
export function dateFromFixed(fixed: number): Temporal.PlainDate {
  return new Temporal.PlainDate(1970, 1, 1).add({
    days: fixed - UNIX_EPOCH_FIXED_DAY,
  });
}
