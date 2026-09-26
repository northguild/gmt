import { formatHourDuration, parseIntervalNanoseconds } from "../../internal";
import {
  parseOperatingSchedule,
  parseScheduleDisambiguation,
  scheduleRunsWithin,
} from "../../internal/operatingSchedule";
import type { Disambiguation, OperatingSchedule } from "../../types";

/**
 * Return how much open time `schedule` has between two instants, as an exact ISO duration.
 *
 * - The open time in the half-open range `[start, end)`: the length of its intersection with
 *   `operatingIntervals(schedule, { start, end })`, summed as `sumIntervals` sums. A support
 *   ticket raised Friday 16:00 and answered Monday 10:00 on a 09:00–17:00 weekday desk has
 *   waited `PT2H` of open time.
 * - Hours are the largest unit (`PT40H`, not `P1DT16H`): an open-time total has no calendar.
 *   Exact to the nanosecond, and elapsed time, not wall-clock distance, so a 00:00–00:00 window
 *   on a New York fall-back date adds 25 hours.
 * - Window edges are local wall times resolved with `resolveLocal` under `disambiguation`
 *   (default `"compatible"`): an edge in a repeated fall-back hour takes the **earlier**
 *   instant, and one in a skipped spring-forward hour the **later** one. `"reject"` returns `""`
 *   when a window with an ambiguous or nonexistent edge reaches the range.
 * - Holidays and overrides apply as in `operatingIntervals`.
 * - `start === end` returns `"PT0S"`.
 * - Returns `""` on invalid input: an invalid instant or `OperatingSchedule`, `start` after
 *   `end`, a `disambiguation` that is not one of the four values, and a range spanning more than
 *   10,000 local dates (about 27 years) counted from the date `start` falls on.
 *
 * @param start ISO 8601 instant string where the clock starts (inclusive)
 * @param end ISO 8601 instant string where the clock stops (exclusive)
 * @param schedule `{ timeZone, weekly, holidays?, overrides? }` operating schedule
 * @param optionsArg optional: disambiguation ("compatible" | "earlier" | "later" | "reject")
 * @returns ISO 8601 duration string of the open time, or "" on invalid input
 *
 * @example operatingTimeBetween("2024-06-14T20:00:00Z", "2024-06-17T14:00:00Z", { timeZone: "America/New_York", weekly: { 1: [{ from: "09:00", to: "17:00" }], 5: [{ from: "09:00", to: "17:00" }] } }) // "PT2H" — Friday 16:00 to Monday 10:00 local
 * @example operatingTimeBetween("2024-06-15T00:00:00Z", "2024-06-16T00:00:00Z", { timeZone: "UTC", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }) // "PT0S" — a closed Saturday
 * @example operatingTimeBetween("2024-11-03T04:00:00Z", "2024-11-04T05:00:00Z", { timeZone: "America/New_York", weekly: { 7: [{ from: "00:00", to: "00:00" }] } }) // "PT25H" — the fall-back day
 * @example operatingTimeBetween("2024-06-10T09:00:00Z", "2024-06-10T09:30:00.5Z", { timeZone: "UTC", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }) // "PT30M0.5S"
 * @example operatingTimeBetween("2024-06-17T00:00:00Z", "2024-06-10T00:00:00Z", { timeZone: "UTC", weekly: {} }) // "" — start after end
 */
export function operatingTimeBetween(
  start: string,
  end: string,
  schedule: OperatingSchedule,
  optionsArg?: { disambiguation?: Disambiguation },
): string {
  try {
    const disambiguation = parseScheduleDisambiguation(optionsArg);
    const resolved = parseOperatingSchedule(schedule);
    const range = parseIntervalNanoseconds({ start, end });

    if (disambiguation === null || resolved === null || range === null) {
      return "";
    }

    const runs = scheduleRunsWithin(resolved, range, disambiguation);

    return runs === null
      ? ""
      : formatHourDuration(
          runs.reduce((total, run) => total + (run.end - run.start), 0n),
        );
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
