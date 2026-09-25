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
 * - Searches up to `within` after `isoString` (default `"P1Y"`), an ISO duration added in the
 *   schedule's zone, so `"P1D"` is one local day. An opening exactly at the horizon counts, and a
 *   horizon past Temporal's last instant stops there.
 *   Returns `""` when the schedule does not open within it, rather than searching forever.
 * - Window edges are local wall times resolved with `resolveLocal` under `disambiguation`
 *   (default `"compatible"`): an edge in a repeated fall-back hour takes the **earlier**
 *   instant, and one in a skipped spring-forward hour the **later** one. `"reject"` returns `""`
 *   when a window with an ambiguous or nonexistent edge could open before the answer.
 * - Holidays and overrides apply as in `operatingIntervals`.
 * - `isoString` is an instant: an offset (`Z`, `±HH:MM`) is required.
 * - Returns `""` on invalid input: an invalid instant or `OperatingSchedule`, a `within` that is
 *   not a non-negative ISO duration, a `disambiguation` that is not one of the four values, and
 *   a search that would go more than 10,000 local dates past the input's date.
 *
 * @param isoString ISO 8601 instant string to search from, inclusive
 * @param schedule `{ timeZone, weekly, holidays?, overrides? }` operating schedule
 * @param optionsArg optional: within (ISO duration, default "P1Y"), disambiguation ("compatible" | "earlier" | "later" | "reject")
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
  optionsArg?: { within?: string; disambiguation?: Disambiguation },
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
      resolved.timeZone,
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
