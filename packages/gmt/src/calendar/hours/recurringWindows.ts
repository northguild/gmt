import { parseIntervalNanoseconds } from "../../internal";
import {
  parseScheduleDisambiguation,
  parseWeeklyPattern,
  scheduleRunsWithin,
} from "../../internal/operatingSchedule";
import type { Disambiguation, Interval, OperatingSchedule } from "../../types";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Return the instants a weekly pattern of local windows is open inside `range`, read in
 * `timeZone`: the primitive under operating hours, curfews and recurring crew windows.
 *
 * - `weekly` maps ISO weekdays (1 = Monday … 7 = Sunday) to `LocalWindow`s of wall time. A
 *   window whose `to` is at or before its `from` wraps past midnight and belongs to the date it
 *   starts on: `{ from: "23:00", to: "06:00" }` under 5 is Friday 23:00 to Saturday 06:00, and
 *   `{ from: "00:00", to: "00:00" }` is the whole day. No holidays or overrides; see
 *   `operatingIntervals` for those.
 * - Each window edge is a local wall time resolved with `resolveLocal` under `disambiguation`
 *   (default `"compatible"`): an edge in a repeated fall-back hour takes the **earlier** instant,
 *   and an edge in a skipped spring-forward hour the **later** one, shifted forward by the gap.
 *   `"earlier"` and `"later"` pick that instant instead, and `"reject"` guesses nothing:
 *   it returns `[]` when a window with an ambiguous or nonexistent edge reaches the range —
 *   when the widest span it could cover (its `from` read `"earlier"`, its `to` read `"later"`)
 *   overlaps `range`. A rejected window elsewhere does not matter.
 * - Windows are elapsed time between their resolved edges, so the wall-clock length is not the
 *   real one on transition nights: in New York, 23:00–06:00 is 8 hours across the fall-back
 *   night and 6 across the spring-forward one, and 00:00–00:00 is 25 and 23 hours.
 * - A window whose edges resolve to an empty or inverted span on a transition night — only a
 *   window shorter than the gap it straddles — is empty that day and left out.
 * - The result is clipped to `range` (half-open), sorted, and merged where windows overlap or
 *   touch, so a run of whole-day windows is one interval. Endpoints are UTC instants ending in
 *   `Z`, except a clipped edge, which is `range`'s own string.
 * - Local dates follow the zone's real days: a date the zone deleted (`Pacific/Apia` skipped
 *   2011-12-30) has no windows, and a date re-entered after a fall-back is counted once.
 * - `[]` is both a legitimate result (closed throughout, or an empty `range`) and the sentinel.
 * - Returns `[]` when `weekly` has a key other than `"1"`–`"7"` or a malformed window, when
 *   `range` is not a valid `Interval`, when `timeZone` is invalid, when `disambiguation` is not
 *   one of the four values, and when the range spans more than about 27 years (10,000 local
 *   days), rather than a truncated list.
 *
 * @param weekly windows by ISO weekday, `{ 1: [{ from: "09:00", to: "17:00" }], … }`
 * @param range `{ start, end }` record of ISO 8601 instant strings to expand the pattern inside
 * @param timeZone IANA timeZone identifier the windows are read in
 * @param optionsArg optional: disambiguation ("compatible" | "earlier" | "later" | "reject")
 * @returns sorted, merged `{ start, end }` records of the open instants, or [] on invalid input
 *
 * @example recurringWindows({ 1: [{ from: "09:00", to: "17:00" }] }, { start: "2024-06-10T00:00:00Z", end: "2024-06-11T00:00:00Z" }, "America/New_York") // [{ start: "2024-06-10T13:00:00Z", end: "2024-06-10T21:00:00Z" }]
 * @example recurringWindows({ 5: [{ from: "23:00", to: "06:00" }] }, { start: "2024-06-14T00:00:00Z", end: "2024-06-16T00:00:00Z" }, "UTC") // [{ start: "2024-06-14T23:00:00Z", end: "2024-06-15T06:00:00Z" }] — Friday night into Saturday
 * @example recurringWindows({ 6: [{ from: "23:00", to: "06:00" }] }, { start: "2024-11-02T00:00:00Z", end: "2024-11-04T00:00:00Z" }, "America/New_York") // [{ start: "2024-11-03T03:00:00Z", end: "2024-11-03T11:00:00Z" }] — 8 hours across the fall-back night
 * @example recurringWindows({ 7: [{ from: "02:30", to: "04:00" }] }, { start: "2024-03-10T00:00:00Z", end: "2024-03-11T00:00:00Z" }, "America/New_York") // [{ start: "2024-03-10T07:30:00Z", end: "2024-03-10T08:00:00Z" }] — 02:30 does not exist; "compatible" reads it as 03:30
 * @example recurringWindows({ 7: [{ from: "02:30", to: "04:00" }] }, { start: "2024-03-10T00:00:00Z", end: "2024-03-11T00:00:00Z" }, "America/New_York", { disambiguation: "reject" }) // []
 * @example recurringWindows({ 1: [{ from: "00:00", to: "00:00" }], 2: [{ from: "00:00", to: "00:00" }] }, { start: "2024-06-10T00:00:00Z", end: "2024-06-13T00:00:00Z" }, "UTC") // [{ start: "2024-06-10T00:00:00Z", end: "2024-06-12T00:00:00Z" }] — touching days merge
 * @example recurringWindows({ 8: [{ from: "09:00", to: "17:00" }] }, { start: "2024-06-10T00:00:00Z", end: "2024-06-11T00:00:00Z" }, "UTC") // [] — not an ISO weekday
 * @example recurringWindows({ 1: [{ from: "9am", to: "17:00" }] }, { start: "2024-06-10T00:00:00Z", end: "2024-06-11T00:00:00Z" }, "UTC") // [] — malformed window
 * @example recurringWindows({ 1: [{ from: "09:00", to: "17:00" }] }, { start: "2024-06-10T00:00:00Z", end: "2024-06-11T00:00:00Z" }, "Invalid/Zone") // []
 */
export function recurringWindows(
  weekly: OperatingSchedule["weekly"],
  range: Interval,
  timeZone: string,
  optionsArg?: { disambiguation?: Disambiguation },
): Interval[] {
  try {
    const disambiguation = parseScheduleDisambiguation(optionsArg);
    const weeklyWindows = parseWeeklyPattern(weekly);
    const bounds = parseIntervalNanoseconds(range);

    if (
      disambiguation === null ||
      weeklyWindows === null ||
      bounds === null ||
      typeof timeZone !== "string" ||
      !isValidTimeZone(timeZone)
    ) {
      return [];
    }

    const runs = scheduleRunsWithin(
      {
        timeZone,
        weekly: weeklyWindows,
        holidays: new Set(),
        overrides: new Map(),
      },
      bounds,
      disambiguation,
    );

    return runs === null
      ? []
      : runs.map((run) => ({ start: run.startText, end: run.endText }));
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
