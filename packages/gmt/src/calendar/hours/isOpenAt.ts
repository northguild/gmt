import { parseInstantNanoseconds } from "../../internal";
import {
  firstOpenInstant,
  parseOperatingSchedule,
  parseScheduleDisambiguation,
} from "../../internal/operatingSchedule";
import type { Disambiguation, OperatingSchedule } from "../../types";

/**
 * Return true when `schedule` is open at the instant `isoString`.
 *
 * - Open means inside one of the half-open intervals `operatingIntervals` returns: an opening
 *   instant is open, a closing instant is closed. Where one window ends as the next begins, the
 *   schedule stays open.
 * - A window belongs to the date it starts on, so a Friday 23:00–06:00 window is open at 01:00
 *   on Saturday even when Saturday is a holiday.
 * - Window edges are local wall times resolved with `resolveLocal` under `disambiguation`
 *   (default `"compatible"`): an edge in a repeated fall-back hour takes the **earlier**
 *   instant, and one in a skipped spring-forward hour the **later** one. `"reject"` returns
 *   `false` when only a window with an ambiguous or nonexistent edge could be open at `isoString`.
 * - `isoString` is an instant: an offset (`Z`, `±HH:MM`) is required, and a bracketed zone is
 *   ignored — the schedule's own zone reads the windows.
 * - Returns `false` on invalid input: an invalid instant or `OperatingSchedule`, or a
 *   `disambiguation` that is not one of the four values. Check the schedule with
 *   `operatingIntervals` when "closed" and "invalid" must be told apart.
 *
 * @param isoString ISO 8601 instant string to test
 * @param schedule `{ timeZone, weekly, holidays?, overrides? }` operating schedule
 * @param optionsArg optional: disambiguation ("compatible" | "earlier" | "later" | "reject")
 * @returns true when open at that instant, or false when closed or on invalid input
 *
 * @example isOpenAt("2024-06-17T14:00:00Z", { timeZone: "America/New_York", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }) // true — Monday 10:00 local
 * @example isOpenAt("2024-06-17T21:00:00Z", { timeZone: "America/New_York", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }) // false — 17:00 local, the window has closed
 * @example isOpenAt("2024-06-15T01:00:00Z", { timeZone: "UTC", weekly: { 5: [{ from: "23:00", to: "06:00" }] } }) // true — Friday's night window, on Saturday morning
 * @example isOpenAt("2024-07-04T14:00:00Z", { timeZone: "America/New_York", weekly: { 4: [{ from: "09:00", to: "17:00" }] }, holidays: ["2024-07-04"] }) // false — a holiday
 * @example isOpenAt("2024-06-17T14:00:00", { timeZone: "UTC", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }) // false — no offset, not an instant
 */
export function isOpenAt(
  isoString: string,
  schedule: OperatingSchedule,
  optionsArg?: { disambiguation?: Disambiguation },
): boolean {
  try {
    const disambiguation = parseScheduleDisambiguation(optionsArg);
    const resolved = parseOperatingSchedule(schedule);
    const at = parseInstantNanoseconds(isoString);

    if (disambiguation === null || resolved === null || at === null) {
      return false;
    }

    return firstOpenInstant(resolved, at, at, disambiguation) === at;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
