import type { Disambiguation, Offset } from "../../types";
import { startOrEndOfUnix } from "./startOrEndOfUnix";

/**
 * Return the end of the quarter for a Unix timestamp.
 *
 * - Converts to ZonedDateTime, calculates quarter end, converts back to epoch.
 * - Q1 ends month 3, Q2 ends month 6, Q3 ends month 9, Q4 ends month 12.
 * - Returns the last millisecond before the next local quarter starts in `timeZone` (see `floorToZone`), so the result is never before `value`: a quarter whose last local hour repeats (`Africa/Cairo`, 2010-09-30) ends with the second pass.
 * - `disambiguation` and `offset` are deprecated and ignored: a boundary is always a real instant, as TC39's `startOfDay()` takes neither.
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), disambiguation and offset (deprecated, ignored)
 * @returns Unix epoch number representing the end of the quarter, or null on invalid input
 *
 * @example endOfQuarterForUnix(1706659200000, { timeZone: "UTC" }) // 1711929599999
 * @example endOfQuarterForUnix(-86400000, { timeZone: "UTC" }) // -1 (Q4 1969 ends Dec 31)
 * @example endOfQuarterForUnix(1285882200000, { timeZone: "Africa/Cairo" }) // 1285883999999 (the second pass of Q3 2010's repeated last hour; the quarter ends after it)
 * @example endOfQuarterForUnix(1285882200000, { timeZone: "Africa/Cairo", disambiguation: "compatible" }) // 1285883999999 (the deprecated option is ignored)
 */
export function endOfQuarterForUnix(
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
  return startOrEndOfUnix(value, "quarter", options ?? {}, true);
}
