import { Temporal } from "../../internal/temporal";
import {
  cutoffAtResolved,
  resolveCutoffTime,
  resolveSharedCutoffOptions,
} from "../../internal/cutoffAtResolved";
import { instantFrom, parseInstantNanoseconds } from "../../internal";
import { isDurationString } from "../../internal/inputChecks";
import { isObject } from "../../internal/isObject";
import type { BusinessCalendar, RollConvention } from "../../types";

/** Options for `cutoffAt`. */
export interface CutoffOptions {
  /**
   * The time zone the cut-off is read in, the terminal's clock: an IANA name or a UTC offset to the
   * minute (what `isValidTimeZone` accepts).
   */
  timeZone: string;
  /**
   * The local time of day the cut-off is pinned to (`"17:00"`), as `isValidTime` accepts.
   *
   * @defaultValue None. The cut-off is the offset taken off the anchor, with no time of day
   * pinned.
   */
  atLocalTime?: string;
  /**
   * The working week and holidays the cut-off's local date is rolled against. Its `timeZone` is
   * not read: `timeZone` above is the local frame. Requires `roll`.
   *
   * @defaultValue None. The cut-off's date is not rolled; a `roll` without it returns `""`.
   */
  calendar?: BusinessCalendar;
  /**
   * How a cut-off on a non-business day moves, as `rollDate` moves it. Requires `calendar`.
   *
   * @defaultValue None. The cut-off's date is not rolled; a `calendar` without it returns `""`.
   */
  roll?: RollConvention;
}

/**
 * Find a deadline stated as an offset before an anchor event, in the local time of the place
 * that enforces it.
 *
 * Logistics deadlines are not fixed timestamps: they count back from an event — a vessel's
 * departure, a flight's, a container's loading — and they move when that event moves. An ocean
 * booking carries a stack of them (documentation, VGM, gate-in, customs); `cutoffSchedule`
 * computes the whole stack at once.
 *
 * - **`atLocalTime` is what makes this more than subtracting a duration.** A cut-off "two days
 *   before, 17:00" is 17:00 local on the date two days earlier — not 48 hours before, which
 *   keeps the departure's time of day, and moves by an hour when a DST transition falls in
 *   between. With `atLocalTime` only the day of the offset result matters: the offset's exact
 *   part (hours and smaller) comes off the anchor's instant, its calendar part (years, months,
 *   weeks, days) off that local date, and the cut-off is `atLocalTime` on the day it lands on.
 *   Because the exact part is taken off before the day is found, it can change the day: from
 *   midnight, `P2DT0.000000001S` lands a day earlier than `P2D`.
 * - **Without `atLocalTime` the offset is taken off as Temporal's `ZonedDateTime#subtract`
 *   takes it:** the calendar part moves the local wall clock — `P2D` from 18:00 is 18:00, 47,
 *   48 or 49 hours earlier — and the exact part is exact elapsed time — `PT96H` is 96 hours,
 *   whatever the clock does. This is the advance-filing shape.
 * - **The anchor is the caller's event.** Loading, departure and arrival are different
 *   instants, and the same offset from the wrong one is late by days. `cutoffAt` never guesses
 *   which event a rule means. The anchor is exact: an instant (`Z`/offset) or a zoned string.
 *   Its bracket never supplies the zone — `timeZone` alone is the local frame — and is not
 *   checked, with one exception: an offset written to the minute that is the bracketed zone's
 *   sub-minute offset rounded (`-00:45[Africa/Monrovia]`, for −00:44:30) names the instant the
 *   zone gives, as `Temporal.ZonedDateTime.from` reads it. The anchor is not cached: a
 *   rescheduled departure is a new call.
 * - **Non-business days roll as the caller says.** With `calendar`, a cut-off on a weekend or
 *   holiday moves by `roll`, as `rollDate` moves it. Every industry answers "what if it lands
 *   on a non-working day" differently, so the convention is always explicit — there is no
 *   default: `calendar` without `roll`, or `roll` without `calendar`, returns `""`. The rolled
 *   day keeps the cut-off's local time of day. `calendar.timeZone` is not read; `timeZone` is
 *   the local frame. `"endOfMonth"` is `rollDate`'s schedule tool, not a cut-off convention.
 * - **The order is not checked.** `cutoffAt` does not check that the cut-off comes before the
 *   anchor: a negative offset, `P0D` with a late `atLocalTime`, `"following"` or `"endOfMonth"`
 *   can each put it after.
 * - **Local-time resolution.** Every local wall time the cut-off lands on — `atLocalTime`, the
 *   calendar part of an unpinned offset, a rolled day — is resolved as `resolveLocal` describes
 *   it: an **ambiguous** wall time (a fall-back hour the clock ran through twice) takes the
 *   **earlier** instant — RFC 5545 §3.3.5's "first occurrence of the referenced time" — and a
 *   **nonexistent** one (a skipped hour, a deleted day) returns `""` rather than being
 *   shifted. An exact result that is not re-resolved stays as it is.
 * - Returns the cut-off as a zoned string in `timeZone`, or `""` on invalid input.
 * - An offset with seconds (`-00:44:30`) returns `""`. A written zone cannot carry seconds (RFC
 *   9557 §4.1), so the result could not name it. Pass the IANA name.
 *
 * @param anchor ISO 8601 instant or zoned datetime string of the event the deadline counts back from
 * @param offset ISO 8601 duration before the anchor
 * @param options The zone the cut-off is read in, the time of day it is pinned to, and how it rolls off a non-business day
 * @returns ISO 8601 zoned datetime string of the cut-off, or "" on invalid input
 *
 * @example cutoffAt("2024-06-14T16:00:00Z", "P2D", { timeZone: "Europe/Amsterdam", atLocalTime: "17:00" }) // "2024-06-12T17:00:00+02:00[Europe/Amsterdam]"
 * @example cutoffAt("2024-06-14T16:00:00Z", "PT48H", { timeZone: "Europe/Amsterdam" }) // "2024-06-12T18:00:00+02:00[Europe/Amsterdam]" (48 hours keeps the departure's 18:00)
 * @example cutoffAt("2024-06-14T16:00:00Z", "P1D", { timeZone: "Europe/Amsterdam", atLocalTime: "10:00" }) // "2024-06-13T10:00:00+02:00[Europe/Amsterdam]"
 * @example cutoffAt("2024-04-09T07:00:00Z", "PT96H", { timeZone: "Australia/Sydney" }) // "2024-04-05T18:00:00+11:00[Australia/Sydney]" (96 elapsed hours across the fall-back)
 * @example cutoffAt("2024-04-01T16:00:00Z", "P2D", { timeZone: "Europe/London", atLocalTime: "17:00" }) // "2024-03-30T17:00:00+00:00[Europe/London]" (17:00 local, across the spring-forward)
 * @example cutoffAt("2024-06-18T16:00:00Z", "P2D", { timeZone: "Europe/Amsterdam", atLocalTime: "17:00", calendar: { weekend: [6, 7], holidays: [], timeZone: "Europe/Amsterdam" }, roll: "preceding" }) // "2024-06-14T17:00:00+02:00[Europe/Amsterdam]" (Sunday rolls back to Friday)
 * @example cutoffAt("2024-06-18T16:00:00Z", "P2D", { timeZone: "Europe/Amsterdam", atLocalTime: "17:00", calendar: { weekend: [6, 7], holidays: [], timeZone: "Europe/Amsterdam" } }) // "" (a calendar needs a roll convention)
 * @example cutoffAt("2024-10-28T18:00:00Z", "P1D", { timeZone: "Europe/London", atLocalTime: "01:30" }) // "2024-10-27T01:30:00+01:00[Europe/London]" (a repeated hour takes the earlier pass)
 * @example cutoffAt("2024-10-07T07:00:00Z", "P1D", { timeZone: "Australia/Sydney", atLocalTime: "02:30" }) // "" (02:30 on 6 October never happened)
 * @example cutoffAt("2024-06-14T18:00:00", "P2D", { timeZone: "Europe/Amsterdam" }) // "" (a zoneless anchor is not a moment)
 * @example cutoffAt("2024-06-14T16:00:00Z", "P2D", { timeZone: "Europe/Amsterdam", roll: "preceding" }) // "" (a roll needs a calendar)
 */
export function cutoffAt(
  anchor: string,
  offset: string,
  options: CutoffOptions,
): string {
  try {
    if (!isObject(options)) {
      return "";
    }
    // Every read of `options` happens here, once.
    const { timeZone, atLocalTime, calendar, roll } =
      options as Partial<CutoffOptions>;
    // The time of day is checked before the calendar is read, so an invalid one never reads it.
    const local = resolveCutoffTime(atLocalTime);
    const shared =
      local === null
        ? null
        : resolveSharedCutoffOptions(timeZone, calendar, roll);
    if (
      shared === null ||
      local === null ||
      parseInstantNanoseconds(anchor) === null ||
      !isDurationString(offset)
    ) {
      return "";
    }

    try {
      const found = cutoffAtResolved(
        instantFrom(anchor),
        Temporal.Duration.from(offset),
        local.time,
        shared,
      );
      return found === null ? "" : found.text;
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
