import { parseIntervalNanoseconds } from "../../internal";
import {
  parseOperatingSchedule,
  parseScheduleDisambiguation,
  scheduleRunsWithin,
} from "../../internal/operatingSchedule";
import type { Disambiguation, Interval, OperatingSchedule } from "../../types";

/**
 * Return the instants an `OperatingSchedule` is open inside `range`: its weekly windows with
 * holidays closed and overrides applied, resolved in the schedule's zone.
 *
 * - Works date by date in `schedule.timeZone`. A date listed in `holidays` has no windows; a
 *   date with an override has exactly the override's windows, holiday or not. `holidays` may be
 *   a `BusinessCalendar`, whose `holidays` are read.
 * - A window belongs to the date it starts on, so a holiday or override on Friday removes or
 *   replaces a Friday 23:00–06:00 window, and one on Saturday leaves it alone.
 * - Window edges are local wall times resolved with `resolveLocal` under `disambiguation`
 *   (default `"compatible"`): an edge in a repeated fall-back hour takes the **earlier**
 *   instant, and one in a skipped spring-forward hour the **later** one. `"reject"` returns `[]`
 *   when a window with an ambiguous or nonexistent edge reaches the range. `recurringWindows`
 *   states the window rules in full.
 * - The result is clipped to `range` (half-open), sorted, and merged where windows overlap or
 *   touch. Endpoints are UTC instants ending in `Z`, except a clipped edge, which is `range`'s
 *   own string.
 * - `[]` is both a legitimate result (closed throughout, or an empty `range`) and the sentinel.
 * - Returns `[]` when `schedule` is not a valid `OperatingSchedule` (a weekday key other than
 *   `"1"`–`"7"`, a malformed window, an invalid zone, holiday or override date, or two overrides
 *   for one date), when `range` is not a valid `Interval`, when `disambiguation` is not one of
 *   the four values, and when the range spans more than 10,000 local dates (about 27 years)
 *   counted from the date `range.start` falls on.
 *
 * @param schedule `{ timeZone, weekly, holidays?, overrides? }` operating schedule
 * @param range `{ start, end }` record of ISO 8601 instant strings to expand the schedule inside
 * @param optionsArg optional: disambiguation ("compatible" | "earlier" | "later" | "reject")
 * @returns sorted, merged `{ start, end }` records of the open instants, or [] on invalid input
 *
 * @example operatingIntervals({ timeZone: "America/New_York", weekly: { 4: [{ from: "09:00", to: "17:00" }], 5: [{ from: "09:00", to: "17:00" }] }, holidays: ["2024-07-04"] }, { start: "2024-07-04T00:00:00Z", end: "2024-07-06T00:00:00Z" }) // [{ start: "2024-07-05T13:00:00Z", end: "2024-07-05T21:00:00Z" }] — the holiday is closed
 * @example operatingIntervals({ timeZone: "America/New_York", weekly: { 4: [{ from: "09:00", to: "17:00" }] }, holidays: ["2024-07-04"], overrides: [{ date: "2024-07-04", windows: [{ from: "10:00", to: "12:00" }] }] }, { start: "2024-07-04T00:00:00Z", end: "2024-07-05T00:00:00Z" }) // [{ start: "2024-07-04T14:00:00Z", end: "2024-07-04T16:00:00Z" }] — the override wins
 * @example operatingIntervals({ timeZone: "UTC", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }, { start: "2024-06-10T12:00:00Z", end: "2024-06-10T14:00:00Z" }) // [{ start: "2024-06-10T12:00:00Z", end: "2024-06-10T14:00:00Z" }] — clipped to the range
 * @example operatingIntervals({ timeZone: "UTC", weekly: { 1: [{ from: "09:00", to: "17:00" }] }, overrides: [{ date: "2024-06-10", windows: [] }] }, { start: "2024-06-10T00:00:00Z", end: "2024-06-11T00:00:00Z" }) // [] — closed by override
 * @example operatingIntervals({ timeZone: "Invalid/Zone", weekly: {} }, { start: "2024-06-10T00:00:00Z", end: "2024-06-11T00:00:00Z" }) // []
 */
export function operatingIntervals(
  schedule: OperatingSchedule,
  range: Interval,
  optionsArg?: { disambiguation?: Disambiguation },
): Interval[] {
  try {
    const disambiguation = parseScheduleDisambiguation(optionsArg);
    const resolved = parseOperatingSchedule(schedule);
    const bounds = parseIntervalNanoseconds(range);

    if (disambiguation === null || resolved === null || bounds === null) {
      return [];
    }

    const runs = scheduleRunsWithin(resolved, bounds, disambiguation);

    return runs === null
      ? []
      : runs.map((run) => ({ start: run.startText, end: run.endText }));
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
