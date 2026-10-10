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
 * - `isoString` is an instant: an offset (`Z`, `±HH:MM`) is required, and a bracketed zone
 *   never supplies the zone — the schedule's own zone reads the windows. Only its instant is
 *   read, a minute-rounded offset as the bracketed zone's real one (see `isValidInstant`).
 * - Returns `false` on invalid input: an invalid instant or `OperatingSchedule`, or a
 *   `disambiguation` that is not one of the four values. Check the schedule with
 *   `operatingIntervals` when "closed" and "invalid" must be told apart.
 * - **Limit at an offset with seconds.** The instant is placed in the offset's whole-minute zone,
 *   moved by its seconds, and the moved instant must be inside Temporal's range. So within the
 *   offset's seconds (under a minute) of the first instant Temporal supports
 *   (`-271821-04-20T00:00:00Z`), for an offset west of UTC, this returns `false`. There `false` is
 *   the sentinel, not a reading of the schedule. An offset to the minute has no such limit.
 *
 * @param isoString ISO 8601 instant string to test
 * @param schedule `{ timeZone, weekly, holidays?, overrides? }` operating schedule
 * @param optionsArg How a window edge on a clock change is resolved
 * @returns true when open at that instant, or false when closed or on invalid input
 *
 * @example isOpenAt("2024-06-17T14:00:00Z", { timeZone: "America/New_York", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }) // true — Monday 10:00 local
 * @example isOpenAt("2024-06-17T21:00:00Z", { timeZone: "America/New_York", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }) // false — 17:00 local, the window has closed
 * @example isOpenAt("2024-06-15T01:00:00Z", { timeZone: "UTC", weekly: { 5: [{ from: "23:00", to: "06:00" }] } }) // true — Friday's night window, on Saturday morning
 * @example isOpenAt("2024-07-04T14:00:00Z", { timeZone: "America/New_York", weekly: { 4: [{ from: "09:00", to: "17:00" }] }, holidays: ["2024-07-04"] }) // false — a holiday
 * @example isOpenAt("2024-06-17T14:00:00", { timeZone: "UTC", weekly: { 1: [{ from: "09:00", to: "17:00" }] } }) // false — no offset, not an instant
 * @example isOpenAt("1970-01-01T08:44:30Z", { timeZone: "-00:44:30", weekly: { 4: [{ from: "08:00", to: "17:00" }] } }) // true (08:00 at a stored offset with seconds)
 */
export function isOpenAt(
  isoString: string,
  schedule: OperatingSchedule,
  optionsArg?: {
    /**
     * How a window edge in a repeated or skipped local hour becomes an instant, as `resolveLocal`
     * resolves it. `"compatible"` takes the earlier instant of a repeated fall-back hour and the
     * later one of a skipped spring-forward hour, and `"earlier"` and `"later"` take that side in
     * both cases. `"reject"` returns `false` when a window with such an edge is the only one that
     * could be open at `isoString`.
     *
     * @defaultValue `"compatible"`, Temporal's default.
     */
    disambiguation?: Disambiguation;
  },
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
