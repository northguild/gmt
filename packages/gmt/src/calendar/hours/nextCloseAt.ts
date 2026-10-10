import { parseInstantNanoseconds } from "../../internal";
import {
  firstClosedInstant,
  instantText,
  parseOperatingSchedule,
  parseScheduleDisambiguation,
  parseSearchHorizon,
} from "../../internal/operatingSchedule";
import type { Disambiguation, OperatingSchedule } from "../../types";

/**
 * Return the first instant at or after `isoString` that `schedule` is closed, as a UTC instant.
 *
 * - Open at `isoString`: returns the end of the open interval holding it — when the gate
 *   closes. Windows that touch are one interval, so a schedule open 00:00–00:00 every day
 *   closes only where a day has no window.
 * - Already closed at `isoString`: returns `isoString` itself, in UTC. Pair it with
 *   `nextOpenAt` to find the next open interval: `nextCloseAt(nextOpenAt(t, s), s)`.
 * - Returns `""` when the schedule stays open past the search horizon — a schedule open around
 *   the clock never closes.
 * - Holidays and overrides apply as in `operatingIntervals`.
 * - `isoString` is an instant: an offset (`Z`, `±HH:MM`) is required.
 * - Returns `""` on invalid input: an invalid instant or `OperatingSchedule`, a `within` that is
 *   not a non-negative ISO duration, a `disambiguation` that is not one of the four values, and
 *   a search that would go more than 10,000 local dates past the input's date.
 * - **Limit at an offset with seconds.** The instant is placed in the offset's whole-minute zone,
 *   moved by its seconds, and the moved instant must be inside Temporal's range. So within the
 *   offset's seconds (under a minute) of the last instant Temporal supports
 *   (`+275760-09-13T00:00:00Z`) for an offset east of UTC, or of the first
 *   (`-271821-04-20T00:00:00Z`) for one west, this returns `""`. An offset to the minute has no
 *   such limit.
 *
 * @param isoString ISO 8601 instant string to search from, inclusive
 * @param schedule `{ timeZone, weekly, holidays?, overrides? }` operating schedule
 * @param optionsArg How far the search goes, and how a window edge on a clock change is resolved
 * @returns UTC instant string ending in "Z", or "" when none within the horizon or on invalid input
 *
 * @example nextCloseAt("2024-06-17T14:00:00Z", { timeZone: "America/New_York", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }) // "2024-06-17T21:00:00Z" — Monday 10:00 to 17:00 local
 * @example nextCloseAt("2024-06-15T16:00:00Z", { timeZone: "America/New_York", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }) // "2024-06-15T16:00:00Z" — already closed
 * @example nextCloseAt("2024-06-14T23:30:00Z", { timeZone: "UTC", weekly: { 5: [{ from: "23:00", to: "06:00" }] } }) // "2024-06-15T06:00:00Z" — Friday's night window
 * @example nextCloseAt("2024-06-17T14:00:00Z", { timeZone: "UTC", weekly: { 1: [{ from: "00:00", to: "00:00" }], 2: [{ from: "00:00", to: "00:00" }] } }) // "2024-06-19T00:00:00Z" — two touching days are one interval
 * @example nextCloseAt("2024-06-17T14:00:00Z", { timeZone: "UTC", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }, { within: "PT1H" }) // "" — still open an hour later
 * @example nextCloseAt("invalid", { timeZone: "UTC", weekly: {} }) // ""
 */
export function nextCloseAt(
  isoString: string,
  schedule: OperatingSchedule,
  optionsArg?: {
    /**
     * How far after `isoString` the search may go, as a non-negative ISO 8601 duration added in the
     * schedule's zone, so `"P1D"` is one local day. A closing exactly at that horizon counts, and a
     * horizon past Temporal's last instant stops there.
     *
     * @defaultValue `"P1Y"`
     */
    within?: string;
    /**
     * How a window edge in a repeated or skipped local hour becomes an instant, as `resolveLocal`
     * resolves it. `"compatible"` takes the earlier instant of a repeated fall-back hour and the
     * later one of a skipped spring-forward hour, and `"earlier"` and `"later"` take that side in
     * both cases. `"reject"` returns `""` when a window with such an edge could keep the schedule
     * open past the answer.
     *
     * @defaultValue `"compatible"`, Temporal's default.
     */
    disambiguation?: Disambiguation;
  },
): string {
  try {
    const disambiguation = parseScheduleDisambiguation(optionsArg);
    const resolved = parseOperatingSchedule(schedule);
    const from = parseInstantNanoseconds(isoString);

    if (disambiguation === null || resolved === null || from === null) {
      return "";
    }

    const horizon = parseSearchHorizon(
      from,
      optionsArg?.within,
      resolved.frame,
    );

    if (horizon === null) {
      return "";
    }

    const answer = firstClosedInstant(resolved, from, horizon, disambiguation);

    return typeof answer === "bigint" ? instantText(answer) : "";
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
