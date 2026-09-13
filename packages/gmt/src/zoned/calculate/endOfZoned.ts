import type { Temporal } from "@js-temporal/polyfill";
import type { Disambiguation, FractionalDigit, Offset } from "../../types";
import { startOrEndOfZoned } from "./startOrEndOfZoned";

/**
 * Return the end of the specified date-time `unit` for a given zoned ISO 8601 datetime string.
 *
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Returns the last instant of the real local `unit` containing `value` in its own zone — one nanosecond before the next bucket `floorToZone` would return — so the result is never before `value`. The second pass of New York's repeated fall-back hour ends at 01:59:59.999999999 −05:00, and `Australia/Lord_Howe`'s 90-minute fall-back hour ends in its new offset.
 * - A transition that reopens the previous local date makes that stretch its own bucket: `America/Goose_Bay`'s 00:01 fall-back on 7 November 2010 re-entered 6 November for 59 minutes, so the day holding `2010-11-06T23:30:00-04:00` ends at 23:59:59.999999999 −04:00.
 * - A midnight repeated on the same date stays one day: `America/Havana`'s 25-hour 2024-11-03 ends at 23:59:59.999999999 −05:00 from either pass of its repeated first hour.
 * - `disambiguation` and `offset` are deprecated and ignored: a boundary is always a real instant, as TC39's `startOfDay()` takes neither.
 * - `fractionalSecondDigits` defaults to 3, 6 or 9 for "millisecond", "microsecond" or "nanosecond", and 0 otherwise.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit Temporal.DateUnit|Temporal.TimeUnit to specify the unit for the end
 * @param options optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number), disambiguation and offset (deprecated, ignored)
 * @returns zoned ISO 8601 string representing the end of the specified unit, or "" on invalid input
 *
 * @example endOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month") // "2024-02-29T23:59:59+00:00[UTC]"
 * @example endOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month", { fractionalSecondDigits: 9 }) // "2024-02-29T23:59:59.999999999+00:00[UTC]"
 * @example endOfZoned("invalid", "month") // ""
 * @example endOfZoned("2024-11-03T01:15:00-05:00[America/New_York]", "hour") // "2024-11-03T01:59:59-05:00[America/New_York]" (the second, repeated 1am is its own hour)
 * @example endOfZoned("2024-11-03T00:30:00-04:00[America/Havana]", "day") // "2024-11-03T23:59:59-05:00[America/Havana]" (midnight repeated on the same date: one 25-hour day)
 * @example endOfZoned("2024-11-03T01:15:00-05:00[America/New_York]", "hour", { disambiguation: "reject" }) // "2024-11-03T01:59:59-05:00[America/New_York]" (the deprecated option is ignored)
 */
export function endOfZoned(
  value: string,
  unit: Temporal.DateUnit | Temporal.TimeUnit,
  optionsArg?: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
    /**
     * @deprecated Ignored. Boundaries are always real instants, matching TC39 `startOfDay()`, which takes no disambiguation or offset. Will be removed in the next major.
     */
    disambiguation?: Disambiguation;
    /**
     * @deprecated Ignored. Boundaries are always real instants, matching TC39 `startOfDay()`, which takes no disambiguation or offset. Will be removed in the next major.
     */
    offset?: Offset;
  },
): string {
  return startOrEndOfZoned(value, unit, optionsArg ?? {}, true);
}
