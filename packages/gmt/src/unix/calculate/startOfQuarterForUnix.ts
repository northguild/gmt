import type { Disambiguation, Offset } from "../../types";
import { startOrEndOfUnix } from "../../internal/startOrEndOfUnix";

/**
 * Return the start of the quarter for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, calculates quarter start, converts back to epoch.
 * - Q1 returns month 1, Q2 returns month 4, Q3 returns month 7, Q4 returns month 10, with every field below the day reset — milliseconds included.
 * - Returns the real start of the local quarter in `timeZone` (see `floorToZone`), so the result is never after `value`.
 * - `disambiguation` and `offset` are deprecated and ignored: a boundary is always a real instant, as TC39's `startOfDay()` takes neither.
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), disambiguation and offset (deprecated, ignored)
 * @returns Unix epoch number representing the start of the quarter, or null on invalid input
 *
 * @example startOfQuarterForUnix(1706659200000, { timeZone: "UTC" }) // 1704067200000
 * @example startOfQuarterForUnix(1715776496789, { timeZone: "UTC" }) // 1711929600000 (2024-05-15T12:34:56.789Z; the milliseconds are reset too)
 * @example startOfQuarterForUnix(-86400000, { timeZone: "UTC" }) // -7948800000 (1969-12-31 is in Q4, which starts Oct 1)
 * @example startOfQuarterForUnix(276046200000, { timeZone: "Africa/Tunis", disambiguation: "later" }) // 276040800000 (the first pass of Q4 1978's repeated first hour; the deprecated option is ignored)
 * @example startOfQuarterForUnix(NaN) // null
 */
export function startOfQuarterForUnix(
  value: number,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
    /**
     * @deprecated Ignored. Boundaries are always real instants, matching TC39 `startOfDay()`, which takes no disambiguation or offset. Will be removed in the next major.
     */
    disambiguation?: Disambiguation;
    /**
     * @deprecated Ignored. Boundaries are always real instants, matching TC39 `startOfDay()`, which takes no disambiguation or offset. Will be removed in the next major.
     */
    offset?: Offset;
  },
): number | null {
  return startOrEndOfUnix(value, "quarter", options ?? {}, false);
}
