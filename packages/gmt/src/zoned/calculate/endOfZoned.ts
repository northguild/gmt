import type { Temporal } from "@js-temporal/polyfill";
import type { DateTimeUnit, FractionalDigit } from "../../types";
import { startOrEndOfZoned } from "../../internal/startOrEndOfZoned";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the end of the specified date-time `unit` for a given zoned ISO 8601 datetime string.
 *
 * - Supports: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond", each also in its plural form (`"days"`), as Temporal accepts.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns "".
 * - Returns the last instant of the real local `unit` containing `value` in its own zone — one nanosecond before the next bucket `floorToZone` would return — so the result is never before `value`. The second pass of New York's repeated fall-back hour ends at 01:59:59.999999999 −05:00, and `Australia/Lord_Howe`'s 90-minute fall-back hour ends in its new offset.
 * - A transition that reopens the previous local date makes that stretch its own bucket: `America/Goose_Bay`'s 00:01 fall-back on 7 November 2010 re-entered 6 November for 59 minutes, so the day holding `2010-11-06T23:30:00-04:00` ends at 23:59:59.999999999 −04:00.
 * - A midnight repeated on the same date stays one day: `America/Havana`'s 25-hour 2024-11-03 ends at 23:59:59.999999999 −05:00 from either pass of its repeated first hour.
 * - Takes no `disambiguation` or `offset`: a boundary is always a real instant, as TC39's `startOfDay()`
 *   takes neither. Those ignored options were removed in 1.16.0.
 * - The end is written at nanosecond precision by default, so the string names the end itself; an explicit `fractionalSecondDigits` (0, 3, 6 or 9) truncates it, as Temporal's `toString` does.
 * - Returns "" for invalid input.
 * - **Compatibility:** before 1.16.0 the default printed only the digits the unit names — none for
 *   `second` and coarser, 3 for `millisecond`, 6 for `microsecond` — which wrote a moment earlier
 *   than the end. Pass that `fractionalSecondDigits` to keep the previous string.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit date or time unit, singular or plural, to specify the unit for the end
 * @param options optional: weekStartsOn ("monday" | "sunday"), fractionalSecondDigits (number)
 * @returns zoned ISO 8601 string representing the end of the specified unit, or "" on invalid input
 *
 * @example endOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month") // "2024-02-29T23:59:59.999999999+00:00[UTC]"
 * @example endOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month", { fractionalSecondDigits: 0 }) // "2024-02-29T23:59:59+00:00[UTC]" — the pre-1.16.0 string
 * @example endOfZoned("2024-02-29T12:34:56+00:00[UTC]", "month", { fractionalSecondDigits: 3 }) // "2024-02-29T23:59:59.999+00:00[UTC]"
 * @example endOfZoned("2024-02-29T12:34:56+01:00[Europe/Berlin]", "hours") // "2024-02-29T12:59:59.999999999+01:00[Europe/Berlin]"
 * @example endOfZoned("invalid", "month") // ""
 * @example endOfZoned("2024-11-03T01:15:00-05:00[America/New_York]", "hour") // "2024-11-03T01:59:59.999999999-05:00[America/New_York]" (the second, repeated 1am is its own hour)
 * @example endOfZoned("2024-11-03T00:30:00-04:00[America/Havana]", "day") // "2024-11-03T23:59:59.999999999-05:00[America/Havana]" (midnight repeated on the same date: one 25-hour day)
 */
export function endOfZoned(
  value: string,
  unit: Temporal.SmallestUnit<DateTimeUnit>,
  optionsArg?: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  if (!isOptionsArgument(optionsArg)) {
    return "";
  }

  return startOrEndOfZoned(value, unit, optionsArg ?? {}, true);
}
