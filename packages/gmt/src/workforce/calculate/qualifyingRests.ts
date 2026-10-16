import { Temporal } from "@js-temporal/polyfill";
import { isObject, nonNegativeExactDurationNanoseconds } from "../../internal";
import { parseDutyLog } from "../../internal/dutyLog";
import { readStatusList, runsOf } from "../../internal/dutyEngine";
import type { DutyEntry, Interval } from "../../types";

/**
 * Return every rest of at least `minimum` in a duty log: the runs of touching entries in any of
 * `spec.statuses` that last that long.
 *
 * - A run is ended by another status or an unlogged gap, never by a change between two of
 *   `statuses`: an off period running straight into a sleeper-berth period is one rest.
 * - The whole log is read. Intervals are UTC instants ending in "Z", in log order.
 * - For two shorter rests that count together, use `qualifyingRestPairs`.
 * - `[]` is both a legitimate result and the sentinel: returned when the log fails
 *   `isValidDutyLog`, when `spec` is not an object, when `statuses` is not an array of strings,
 *   and when `minimum` is not a positive ISO 8601 duration of exact time.
 *
 * @param log the duty log, ordered and non-overlapping
 * @param spec the statuses a rest is made of and the shortest that counts
 * @returns the rests' `{ start, end }` records, or [] on invalid input
 *
 * @example qualifyingRests([{ status: "off", start: "2024-01-01T00:00:00Z", end: "2024-01-01T10:00:00Z" }, { status: "work", start: "2024-01-01T10:00:00Z", end: "2024-01-01T16:00:00Z" }, { status: "off", start: "2024-01-01T16:00:00Z", end: "2024-01-01T23:00:00Z" }], { statuses: ["off"], minimum: "PT10H" }) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T10:00:00Z" }]
 * @example qualifyingRests([{ status: "off", start: "2024-01-01T00:00:00Z", end: "2024-01-01T05:00:00Z" }, { status: "sleeper", start: "2024-01-01T05:00:00Z", end: "2024-01-01T12:00:00Z" }], { statuses: ["off", "sleeper"], minimum: "PT10H" }) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T12:00:00Z" }] — one rest
 * @example qualifyingRests([], { statuses: ["off"], minimum: "PT0S" }) // [] — a zero minimum
 */
export function qualifyingRests(
  log: DutyEntry[],
  spec: {
    /** The statuses a rest is made of. Touching entries in any of them are one rest. */
    statuses: string[];
    /** The shortest rest returned, a positive ISO 8601 duration of exact time (`"PT10H"`). */
    minimum: string;
  },
): Interval[] {
  try {
    const entries = parseDutyLog(log);

    if (entries === null || !isObject(spec)) {
      return [];
    }

    const { statuses, minimum } = spec as {
      statuses?: unknown;
      minimum?: unknown;
    };
    const wanted = readStatusList(statuses);
    const floor = nonNegativeExactDurationNanoseconds(minimum);

    if (wanted === null || floor === null || floor === 0n) {
      return [];
    }

    return runsOf(entries, wanted)
      .filter((run) => run.end - run.start >= floor)
      .map((run) => ({
        start: Temporal.Instant.fromEpochNanoseconds(run.start).toString(),
        end: Temporal.Instant.fromEpochNanoseconds(run.end).toString(),
      }));
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
