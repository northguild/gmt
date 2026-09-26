import { parseInstantNanoseconds } from "../../internal";
import {
  instantAfterOpenTime,
  instantText,
  parseOpenTimeAmount,
  parseOperatingSchedule,
  parseScheduleDisambiguation,
  parseSearchHorizon,
} from "../../internal/operatingSchedule";
import type { Disambiguation, OperatingSchedule } from "../../types";

/**
 * Return the instant at which `duration` of open time has elapsed since `start`: the deadline
 * of a service level measured in working hours.
 *
 * - The earliest instant `X` such that `operatingTimeBetween(start, X, schedule)` equals
 *   `duration`. The clock stops while the schedule is closed and resumes when it reopens, so an
 *   eight-hour SLA raised at Friday 16:00 on a 09:00–17:00 weekday desk falls due on Monday at
 *   16:00. A deadline that lands exactly on a closing time is that closing instant, not the next
 *   opening.
 * - `duration` is hours and smaller units (`"PT8H"`, `"PT90M"`). A duration with days, weeks,
 *   months or years returns `""`: `P1D` of open time could mean 24 open hours or one working
 *   day, and GMT does not guess. `"PT0S"` returns `start` itself, in UTC.
 * - Searches up to `within` after `start` (default `"P1Y"`), an ISO duration added in the
 *   schedule's zone, so `"P1D"` is one local day. A deadline exactly at the horizon counts, and a
 *   horizon past Temporal's last instant stops there.
 *   Returns `""` when the deadline would fall past it, rather than searching forever.
 * - Window edges are local wall times resolved with `resolveLocal` under `disambiguation`
 *   (default `"compatible"`): an edge in a repeated fall-back hour takes the **earlier**
 *   instant, and one in a skipped spring-forward hour the **later** one. `"reject"` returns `""`
 *   when a window with an ambiguous or nonexistent edge could add open time before the deadline.
 * - Holidays and overrides apply as in `operatingIntervals`.
 * - Returns `""` on invalid input: an invalid instant, duration or `OperatingSchedule`, a
 *   negative `duration`, a `within` that is not a non-negative ISO duration, a `disambiguation`
 *   that is not one of the four values, and a search that would go more than 10,000 local dates past the input's date.
 *
 * @param start ISO 8601 instant string where the clock starts
 * @param duration ISO 8601 duration of open time, hours and smaller units (e.g. "PT8H")
 * @param schedule `{ timeZone, weekly, holidays?, overrides? }` operating schedule
 * @param optionsArg optional: within (ISO duration, default "P1Y"), disambiguation ("compatible" | "earlier" | "later" | "reject")
 * @returns UTC instant string ending in "Z", or "" when past the horizon or on invalid input
 *
 * @example addOperatingTime("2024-06-14T20:00:00Z", "PT2H", { timeZone: "America/New_York", weekly: { 1: [{ from: "09:00", to: "17:00" }], 5: [{ from: "09:00", to: "17:00" }] } }) // "2024-06-17T14:00:00Z" — Friday 16:00 to Monday 10:00 local
 * @example addOperatingTime("2024-06-14T20:00:00Z", "PT1H", { timeZone: "America/New_York", weekly: { 5: [{ from: "09:00", to: "17:00" }] } }) // "2024-06-14T21:00:00Z" — due at closing, not at the next opening
 * @example addOperatingTime("2024-06-14T20:00:00Z", "PT2H", { timeZone: "America/New_York", weekly: { 1: [{ from: "09:00", to: "17:00" }], 5: [{ from: "09:00", to: "17:00" }] } }, { within: "P1D" }) // "" — past the horizon
 * @example addOperatingTime("2024-06-15T12:00:00Z", "PT0S", { timeZone: "UTC", weekly: {} }) // "2024-06-15T12:00:00Z"
 * @example addOperatingTime("2024-06-14T20:00:00Z", "P1D", { timeZone: "UTC", weekly: { 5: [{ from: "09:00", to: "17:00" }] } }) // "" — days are not open time
 * @example addOperatingTime("2024-06-14T20:00:00Z", "-PT1H", { timeZone: "UTC", weekly: { 5: [{ from: "09:00", to: "17:00" }] } }) // ""
 */
export function addOperatingTime(
  start: string,
  duration: string,
  schedule: OperatingSchedule,
  optionsArg?: { within?: string; disambiguation?: Disambiguation },
): string {
  try {
    const disambiguation = parseScheduleDisambiguation(optionsArg);
    const resolved = parseOperatingSchedule(schedule);
    const from = parseInstantNanoseconds(start);
    const amount = parseOpenTimeAmount(duration);

    if (
      disambiguation === null ||
      resolved === null ||
      from === null ||
      amount === null
    ) {
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

    const answer = instantAfterOpenTime(
      resolved,
      from,
      amount,
      horizon,
      disambiguation,
    );

    return typeof answer === "bigint" ? instantText(answer) : "";
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
