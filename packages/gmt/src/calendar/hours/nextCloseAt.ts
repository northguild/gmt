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
 * - Searches up to `within` after `isoString` (default `"P1Y"`), an ISO duration added in the
 *   schedule's zone. A closing exactly at the horizon counts, and a horizon past
 *   Temporal's last instant stops there. Returns `""` when the schedule
 *   stays open past it — a schedule open around the clock never closes.
 * - Window edges are local wall times resolved with `resolveLocal` under `disambiguation`
 *   (default `"compatible"`): an edge in a repeated fall-back hour takes the **earlier**
 *   instant, and one in a skipped spring-forward hour the **later** one. `"reject"` returns `""`
 *   when a window with an ambiguous or nonexistent edge could keep the schedule open past the
 *   answer.
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

    const answer = firstClosedInstant(resolved, from, horizon, disambiguation);

    return typeof answer === "bigint" ? instantText(answer) : "";
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
