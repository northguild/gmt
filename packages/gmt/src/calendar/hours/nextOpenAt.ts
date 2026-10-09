import { parseInstantNanoseconds } from "../../internal";
import {
  firstOpenInstant,
  instantText,
  parseOperatingSchedule,
  parseScheduleDisambiguation,
  parseSearchHorizon,
} from "../../internal/operatingSchedule";
import type { Disambiguation, OperatingSchedule } from "../../types";

/**
 * Return the first instant at or after `isoString` that `schedule` is open, as a UTC instant.
 *
 * - Already open at `isoString`: returns `isoString` itself, in UTC. Otherwise returns the start
 *   of the next open interval — the moment a gate opens, or a notice can be tendered.
 * - Returns `""` when the schedule does not open within the search horizon, rather than
 *   searching forever.
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
 * @example nextOpenAt("2024-06-15T16:00:00Z", { timeZone: "America/New_York", weekly: { 1: [{ from: "09:00", to: "17:00" }], 5: [{ from: "09:00", to: "17:00" }] } }) // "2024-06-17T13:00:00Z" — Saturday noon to Monday 09:00 local
 * @example nextOpenAt("2024-06-17T14:00:00Z", { timeZone: "America/New_York", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }) // "2024-06-17T14:00:00Z" — already open
 * @example nextOpenAt("2024-06-15T16:00:00Z", { timeZone: "America/New_York", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }, { within: "P1D" }) // "" — Monday is past the horizon
 * @example nextOpenAt("2024-06-15T16:00:00Z", { timeZone: "UTC", weekly: {} }) // "" — never opens
 * @example nextOpenAt("2024-06-15T16:00:00Z", { timeZone: "UTC", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }, { within: "-P1D" }) // ""
 */
export function nextOpenAt(
  isoString: string,
  schedule: OperatingSchedule,
  optionsArg?: {
    /**
     * How far after `isoString` the search may go, as a non-negative ISO 8601 duration added in the
     * schedule's zone, so `"P1D"` is one local day. An opening exactly at that horizon counts, and a
     * horizon past Temporal's last instant stops there.
     *
     * @defaultValue `"P1Y"`
     */
    within?: string;
    /**
     * How a window edge in a repeated or skipped local hour becomes an instant, as `resolveLocal`
     * resolves it. `"compatible"` takes the earlier instant of a repeated fall-back hour and the
     * later one of a skipped spring-forward hour, and `"earlier"` and `"later"` take that side in
     * both cases. `"reject"` returns `""` when a window with such an edge could open before the
     * answer.
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

    const answer = firstOpenInstant(resolved, from, horizon, disambiguation);

    return typeof answer === "bigint" ? instantText(answer) : "";
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
