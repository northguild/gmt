import { formatHourDuration, parseIntervalNanoseconds } from "../../internal";
import { parseDutyLog } from "../../internal/dutyLog";
import { readStatusList, timeIn } from "../../internal/dutyEngine";
import type { DutyEntry, Interval } from "../../types";

/**
 * Return the time a duty log spends in any of `statuses` inside a window, as an exact ISO 8601
 * duration.
 *
 * - The interval algebra of CORE-6: the entries in `statuses` are merged, each run is cut to
 *   `window` (half-open), and what is left is summed. An entry that crosses the window's edge
 *   counts only its part inside.
 * - Hours are the largest unit, as `sumIntervals` writes it: `"PT49H30M"`, never days.
 * - `[]` as `statuses`, an empty log or an empty window gives `"PT0S"`.
 * - Returns `""` when the log fails `isValidDutyLog`, when `window` is not a valid `Interval`, and
 *   when `statuses` is not an array of strings.
 *
 * @param log the duty log, ordered and non-overlapping
 * @param window `{ start, end }` record of ISO 8601 instant strings to total inside
 * @param statuses the statuses whose time is totalled
 * @returns ISO 8601 duration string, or "" on invalid input
 *
 * @example dutyTotals([{ status: "driving", start: "2024-01-01T10:00:00Z", end: "2024-01-01T15:00:00Z" }, { status: "onDuty", start: "2024-01-01T15:00:00Z", end: "2024-01-01T17:00:00Z" }, { status: "driving", start: "2024-01-01T17:00:00Z", end: "2024-01-01T20:00:00Z" }], { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }, ["driving"]) // "PT8H"
 * @example dutyTotals([{ status: "driving", start: "2024-01-01T10:00:00Z", end: "2024-01-01T15:00:00Z" }], { start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" }, ["driving"]) // "PT3H" — cut at the window
 * @example dutyTotals([], { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }, ["driving"]) // "PT0S"
 * @example dutyTotals([{ status: "driving", start: "2024-01-01T15:00:00Z", end: "2024-01-01T10:00:00Z" }], { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }, ["driving"]) // "" — inverted entry
 */
export function dutyTotals(
  log: DutyEntry[],
  window: Interval,
  statuses: string[],
): string {
  try {
    const entries = parseDutyLog(log);
    const bounds = parseIntervalNanoseconds(window);
    const counted = readStatusList(statuses);

    if (entries === null || bounds === null || counted === null) {
      return "";
    }

    return formatHourDuration(
      timeIn(entries, counted, bounds.start, bounds.end),
    );
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
