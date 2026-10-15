import { Temporal } from "@js-temporal/polyfill";
import { formatHourDuration, parseIntervalNanoseconds } from "../../internal";
import { parseDutyLog } from "../../internal/dutyLog";
import { clipRuns, readStatusList, runsOf } from "../../internal/dutyEngine";
import type { DutyEntry, Interval } from "../../types";

/**
 * Return the longest unbroken stretch a duty log spends in any of `statuses` inside a window.
 *
 * - A stretch is a run of touching entries whose statuses are all in `statuses`; another status
 *   or an unlogged gap ends it. Each run is cut to `window` (half-open) before it is measured.
 * - On a tie the earlier stretch is returned.
 * - `interval` is in UTC instants ending in "Z"; `duration` is an exact ISO 8601 duration with
 *   hours as the largest unit.
 * - Returns `null` when no stretch falls inside the window, which is also the sentinel: when the
 *   log fails `isValidDutyLog`, when `window` is not a valid `Interval`, and when `statuses` is not
 *   an array of strings.
 *
 * @param log the duty log, ordered and non-overlapping
 * @param window `{ start, end }` record of ISO 8601 instant strings to search inside
 * @param statuses the statuses a stretch is made of
 * @returns `{ interval, duration }` of the longest stretch, or null when there is none or on invalid input
 *
 * @example longestRun([{ status: "driving", start: "2024-01-01T00:00:00Z", end: "2024-01-01T03:00:00Z" }, { status: "onDuty", start: "2024-01-01T03:00:00Z", end: "2024-01-01T04:00:00Z" }, { status: "driving", start: "2024-01-01T04:00:00Z", end: "2024-01-01T08:00:00Z" }], { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }, ["driving"]) // { interval: { start: "2024-01-01T04:00:00Z", end: "2024-01-01T08:00:00Z" }, duration: "PT4H" }
 * @example longestRun([{ status: "driving", start: "2024-01-01T00:00:00Z", end: "2024-01-01T03:00:00Z" }, { status: "onDuty", start: "2024-01-01T03:00:00Z", end: "2024-01-01T04:00:00Z" }], { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }, ["driving", "onDuty"]) // { interval: { start: "2024-01-01T00:00:00Z", end: "2024-01-01T04:00:00Z" }, duration: "PT4H" } — touching entries join
 * @example longestRun([{ status: "off", start: "2024-01-01T00:00:00Z", end: "2024-01-01T08:00:00Z" }], { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }, ["driving"]) // null — none
 */
export function longestRun(
  log: DutyEntry[],
  window: Interval,
  statuses: string[],
): {
  /** The stretch, as UTC instants ending in "Z", cut to the window. */
  interval: Interval;
  /** Its length, an exact ISO 8601 duration with hours as the largest unit. */
  duration: string;
} | null {
  try {
    const entries = parseDutyLog(log);
    const bounds = parseIntervalNanoseconds(window);
    const wanted = readStatusList(statuses);

    if (entries === null || bounds === null || wanted === null) {
      return null;
    }

    const runs = clipRuns(runsOf(entries, wanted), bounds.start, bounds.end);
    const longest = runs.reduce<(typeof runs)[number] | undefined>(
      (best, run) =>
        best === undefined || run.end - run.start > best.end - best.start
          ? run
          : best,
      undefined,
    );

    if (longest === undefined) {
      return null;
    }

    return {
      interval: {
        start: Temporal.Instant.fromEpochNanoseconds(longest.start).toString(),
        end: Temporal.Instant.fromEpochNanoseconds(longest.end).toString(),
      },
      duration: formatHourDuration(longest.end - longest.start),
    };
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
