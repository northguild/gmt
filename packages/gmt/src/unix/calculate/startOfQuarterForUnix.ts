import { startOrEndOfUnix } from "../../internal/startOrEndOfUnix";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the start of the quarter for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, calculates quarter start, converts back to epoch.
 * - Q1 returns month 1, Q2 returns month 4, Q3 returns month 7, Q4 returns month 10, with every field below the day reset — milliseconds included.
 * - Returns the real start of the local quarter in `timeZone` (see `floorToZone`), so the result is never after `value`.
 * - Takes no `disambiguation` or `offset`: a boundary is always a real instant, as TC39's `startOfDay()`
 *   takes neither. Those ignored options were removed in 1.16.0.
 * - Returns null for invalid input.
 * - `value` is a safe integer or a digit string (`"1706659200000"`); anything else returns null.
 * - An omitted `timeZone` is UTC; pass `"local"` for the system time zone. An unknown zone returns
 *   null.
 *
 * @param value Unix epoch: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC")
 * @returns Unix epoch number representing the start of the quarter, or null on invalid input
 *
 * @example startOfQuarterForUnix(1706659200000, { timeZone: "UTC" }) // 1704067200000
 * @example startOfQuarterForUnix(1715776496789, { timeZone: "UTC" }) // 1711929600000 (2024-05-15T12:34:56.789Z; the milliseconds are reset too)
 * @example startOfQuarterForUnix(-86400000, { timeZone: "UTC" }) // -7948800000 (1969-12-31 is in Q4, which starts Oct 1)
 * @example startOfQuarterForUnix(276046200000, { timeZone: "Africa/Tunis" }) // 276040800000 (the first pass of Q4 1978's repeated first hour)
 * @example startOfQuarterForUnix(NaN) // null
 */
export function startOfQuarterForUnix(
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

    return startOrEndOfUnix(value, "quarter", options ?? {}, false);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
