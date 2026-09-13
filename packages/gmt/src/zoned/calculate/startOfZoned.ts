import type {
  DateTimeUnit,
  Disambiguation,
  FractionalDigit,
  Offset,
} from "../../types";
import { startOrEndOfZoned } from "./startOrEndOfZoned";

/**
 * Return the start of the specified date-time `unit` for a given zoned ISO 8601 datetime string.
 *
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Returns the real start of the local `unit` containing `value` in its own zone — the same bucket `floorToZone` uses — so the result is never after `value`. A local hour `Pacific/Chatham`'s spring-forward leaves only 15 minutes long starts at 03:45, the second pass of New York's repeated fall-back hour starts at its own 01:00 (−05:00), and a day whose midnight was skipped starts at its first real instant.
 * - A transition that reopens the previous local date makes that stretch its own bucket. `America/Goose_Bay` fell back at 00:01 on 7 November 2010, re-entering 6 November for 59 minutes, so `2010-11-06T23:30:00-04:00` has a day that starts at 23:01 — consistent with `floorToZone`, `bucketRange` and `intervalCountZoned`.
 * - A midnight repeated on the same date stays one day: `America/Havana`'s 2024-11-03 starts at its first 00:00 (−04:00) and runs 25 hours, matching Temporal's `startOfDay()`.
 * - `disambiguation` and `offset` are deprecated and ignored: a boundary is always a real instant, as TC39's `startOfDay()` takes neither.
 * - `fractionalSecondDigits` defaults to 3, 6 or 9 for "millisecond", "microsecond" or "nanosecond", and 0 otherwise.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit Temporal.DateUnit|Temporal.TimeUnit to specify the unit for the start
 * @param options optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number), disambiguation and offset (deprecated, ignored)
 * @returns zoned ISO 8601 string representing the start of the specified unit, or "" on invalid input
 *
 * @example startOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month") // "2024-02-01T00:00:00+00:00[UTC]"
 * @example startOfZoned("invalid", "month") // ""
 * @example startOfZoned("2024-11-03T01:45:00-05:00[America/New_York]", "hour") // "2024-11-03T01:00:00-05:00[America/New_York]" (the second, repeated 1am is its own hour)
 * @example startOfZoned("2024-09-29T03:50:00+13:45[Pacific/Chatham]", "hour") // "2024-09-29T03:45:00+13:45[Pacific/Chatham]" (local 03:00 never happened; the hour began at the jump)
 * @example startOfZoned("2024-11-03T00:30:00-05:00[America/Havana]", "day") // "2024-11-03T00:00:00-04:00[America/Havana]" (midnight repeated on the same date: one 25-hour day)
 * @example startOfZoned("2024-11-03T01:45:00-05:00[America/New_York]", "hour", { disambiguation: "reject" }) // "2024-11-03T01:00:00-05:00[America/New_York]" (the deprecated option is ignored)
 */
export function startOfZoned(
  value: string,
  unit: DateTimeUnit,
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
  return startOrEndOfZoned(value, unit, optionsArg ?? {}, false);
}
