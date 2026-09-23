import { startOrEndOfUnix } from "../../internal/startOrEndOfUnix";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the end of the quarter for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, calculates quarter end, converts back to epoch.
 * - Q1 ends month 3, Q2 ends month 6, Q3 ends month 9, Q4 ends month 12.
 * - Returns the last millisecond before the next local quarter starts in `timeZone` (see `floorToZone`), so the result is never before `value`: a quarter whose last local hour repeats (`Africa/Cairo`, 2010-09-30) ends with the second pass.
 * - Takes no `disambiguation` or `offset`: a boundary is always a real instant, as TC39's `startOfDay()`
 *   takes neither. Those ignored options were removed in 1.16.0.
 * - Returns null for invalid input.
 * - `value` is a safe integer or a digit string (`"1706659200000"`); anything else returns null.
 * - An omitted `timeZone` is UTC; pass `"local"` for the system time zone. An unknown zone returns
 *   null.
 *
 * @param value Unix epoch: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC")
 * @returns Unix epoch number representing the end of the quarter, or null on invalid input
 *
 * @example endOfQuarterForUnix(1706659200000, { timeZone: "UTC" }) // 1711929599999
 * @example endOfQuarterForUnix(-86400000, { timeZone: "UTC" }) // -1 (Q4 1969 ends Dec 31)
 * @example endOfQuarterForUnix(1285882200000, { timeZone: "Africa/Cairo" }) // 1285883999999 (the second pass of Q3 2010's repeated last hour; the quarter ends after it)
 * @example endOfQuarterForUnix(NaN) // null
 */
export function endOfQuarterForUnix(
  value: number | string,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
  },
): number | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }

    return startOrEndOfUnix(value, "quarter", options ?? {}, true);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
