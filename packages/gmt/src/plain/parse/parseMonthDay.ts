import { plainMonthDayOf } from "../../internal/inputChecks";
import { monthDayString } from "../../internal/monthDay";

/**
 * Return the canonical `--MM-DD` form of an ISO month-day string.
 *
 * - Reads `--MM-DD` and `MM-DD`; writes `--MM-DD`. The reference year 1972 is never written.
 * - The extended form only: `--1225` and `1225` are refused.
 * - Annotations are read as `isValidMonthDay` reads them: elective and time zone annotations are
 *   ignored, an unknown critical one refuses, and `u-ca` must be `iso8601` in any case.
 * - `--02-29` is valid; `--02-30` and `--04-31` are not.
 * - Returns "" for invalid input.
 *
 * @param value ISO month-day string
 * @returns the `--MM-DD` string, or "" on invalid input
 *
 * @example parseMonthDay("--12-25") // "--12-25"
 * @example parseMonthDay("12-25") // "--12-25"
 * @example parseMonthDay("--02-29") // "--02-29"
 * @example parseMonthDay("--12-25[u-ca=ISO8601]") // "--12-25"
 * @example parseMonthDay("--02-30") // ""
 * @example parseMonthDay("--1225") // ""
 */
export function parseMonthDay(value: string): string {
  const monthDay = plainMonthDayOf(value);
  return monthDay === null ? "" : monthDayString(monthDay);
}
