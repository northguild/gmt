import { Temporal } from "@js-temporal/polyfill";
import { rollDate } from "../../calendar/business/rollDate";
import { isValidBusinessCalendar } from "../../calendar/validate/isValidBusinessCalendar";
import { isValidRollConvention } from "../../calendar/validate/isValidRollConvention";
import { isValidDuration } from "../../duration/validate/isValidDuration";
import { classifyLocal } from "../../instant/convert/classifyLocal";
import { resolveLocal } from "../../instant/convert/resolveLocal";
import { isObject } from "../../internal/isObject";
import { isValidTime } from "../../plain/validate/isValidTime";
import { isValidInstant } from "../../precision/validate/isValidInstant";
import type { BusinessCalendar, RollConvention } from "../../types";
import { isValidTimeZone } from "../../zoned/validate/isValidTimeZone";

/** Options for `cutoffAt`. */
export interface CutoffOptions {
  /** IANA timeZone identifier or fixed offset the cut-off is read in — the terminal's clock. */
  timeZone: string;
  /**
   * Local time of day the cut-off is pinned to (`"17:00"`), as `isValidTime` accepts. Omit it
   * for a cut-off that is an exact offset from the anchor.
   */
  atLocalTime?: string;
  /** Working week and holidays the cut-off's local date is rolled against. */
  calendar?: BusinessCalendar;
  /** How a cut-off on a non-business day moves. Default `"preceding"`; needs `calendar`. */
  roll?: RollConvention;
}

/** The validated options, with the default roll applied. */
type ResolvedCutoffOptions = {
  timeZone: string;
  atLocalTime: Temporal.PlainTime | null;
  calendar: BusinessCalendar | null;
  roll: RollConvention;
};

function resolveOptions(options: unknown): ResolvedCutoffOptions | null {
  if (!isObject(options)) {
    return null;
  }
  const { timeZone, atLocalTime, calendar, roll } =
    options as Partial<CutoffOptions>;
  if (typeof timeZone !== "string" || !isValidTimeZone(timeZone)) {
    return null;
  }
  if (atLocalTime !== undefined && !isValidTime(atLocalTime)) {
    return null;
  }
  if (calendar !== undefined && !isValidBusinessCalendar(calendar)) {
    return null;
  }
  // A roll with nothing to roll against is a missing calendar, not a no-op.
  if (
    roll !== undefined &&
    (calendar === undefined || !isValidRollConvention(roll))
  ) {
    return null;
  }
  return {
    timeZone,
    atLocalTime:
      atLocalTime === undefined ? null : Temporal.PlainTime.from(atLocalTime),
    calendar: calendar ?? null,
    roll: roll ?? "preceding",
  };
}

/**
 * The instant a local wall time names, for a deadline: the earlier pass of a repeated hour, so
 * a deadline never moves later, and `null` for a skipped one, which is never shifted.
 */
function resolveWallTime(
  wall: Temporal.PlainDateTime,
  timeZone: string,
): Temporal.ZonedDateTime | null {
  const local = wall.toString();
  const kind = classifyLocal(local, timeZone);
  if (kind === null || kind === "nonexistent") {
    return null;
  }
  const instant = resolveLocal(local, timeZone, { disambiguation: "earlier" });
  return instant === ""
    ? null
    : Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
}

/** The calendar part of a duration — years, months, weeks and days. */
function datePart(offset: Temporal.Duration): Temporal.Duration {
  return Temporal.Duration.from({
    years: offset.years,
    months: offset.months,
    weeks: offset.weeks,
    days: offset.days,
  });
}

/** The exact part of a duration — hours and smaller. */
function timePart(offset: Temporal.Duration): Temporal.Duration {
  return Temporal.Duration.from({
    hours: offset.hours,
    minutes: offset.minutes,
    seconds: offset.seconds,
    milliseconds: offset.milliseconds,
    microseconds: offset.microseconds,
    nanoseconds: offset.nanoseconds,
  });
}

/**
 * The offset taken off the anchor with no pinning: the calendar part moves the local wall
 * clock, then the exact part comes off in exact time — Temporal's `ZonedDateTime#subtract`,
 * except that a wall clock landing in a skipped hour is `null` rather than moved forward.
 */
function subtractOffset(
  anchor: Temporal.ZonedDateTime,
  offset: Temporal.Duration,
): Temporal.ZonedDateTime | null {
  const calendarPart = datePart(offset);
  if (calendarPart.blank) {
    return anchor.subtract(timePart(offset));
  }
  const wall = resolveWallTime(
    anchor.toPlainDateTime().subtract(calendarPart),
    anchor.timeZoneId,
  );
  return wall === null ? null : wall.subtract(timePart(offset));
}

/**
 * The local date the cut-off falls on after rolling, or `null` when the roll fails. With no
 * calendar the date is left as it is.
 */
function rolledDate(
  date: Temporal.PlainDate,
  options: ResolvedCutoffOptions,
): Temporal.PlainDate | null {
  if (options.calendar === null) {
    return date;
  }
  const rolled = rollDate(date.toString(), options.roll, options.calendar);
  return rolled === "" ? null : Temporal.PlainDate.from(rolled);
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
 * - **Without `atLocalTime` the offset is taken off as Temporal's `ZonedDateTime#subtract`
 *   takes it:** the calendar part moves the local wall clock — `P2D` from 18:00 is 18:00, 47,
 *   48 or 49 hours earlier — and the exact part is exact elapsed time — `PT96H` is 96 hours,
 *   whatever the clock does. This is the advance-filing shape.
 * - **The anchor is the caller's event.** Loading, departure and arrival are different
 *   instants, and the same offset from the wrong one is late by days. `cutoffAt` never guesses
 *   which event a rule means. The anchor is exact: an instant (`Z`/offset) or a zoned string,
 *   whose bracket is not read — `timeZone` alone is the local frame. It is not cached: a
 *   rescheduled departure is a new call.
 * - **Non-business days roll backward.** With `calendar`, a cut-off on a weekend or holiday
 *   moves by `roll`, default `"preceding"`: a deadline never moves later to fit a closure. The
 *   rolled day keeps the cut-off's local time of day. `roll` without `calendar` returns `""`.
 * - **Local-time resolution.** Every local wall time the cut-off lands on — `atLocalTime`, the
 *   calendar part of an unpinned offset, a rolled day — is resolved as `resolveLocal` describes
 *   it: an **ambiguous** wall time (a fall-back hour the clock ran through twice) takes the
 *   **earlier** instant, and a **nonexistent** one (a skipped hour, a deleted day) returns `""`
 *   rather than being shifted. An exact result that is not re-resolved stays as it is.
 * - A negative offset puts the cut-off after the anchor.
 * - Returns the cut-off as a zoned string in `timeZone`, or `""` on invalid input.
 *
 * @param anchor ISO 8601 instant or zoned datetime string of the event the deadline counts back from
 * @param offset ISO 8601 duration before the anchor
 * @param options timeZone (IANA identifier or fixed offset, required); optional atLocalTime, calendar and roll
 * @returns ISO 8601 zoned datetime string of the cut-off, or "" on invalid input
 *
 * @example cutoffAt("2024-06-14T16:00:00Z", "P2D", { timeZone: "Europe/Amsterdam", atLocalTime: "17:00" }) // "2024-06-12T17:00:00+02:00[Europe/Amsterdam]"
 * @example cutoffAt("2024-06-14T16:00:00Z", "PT48H", { timeZone: "Europe/Amsterdam" }) // "2024-06-12T18:00:00+02:00[Europe/Amsterdam]" (48 hours keeps the departure's 18:00)
 * @example cutoffAt("2024-06-14T16:00:00Z", "P1D", { timeZone: "Europe/Amsterdam", atLocalTime: "10:00" }) // "2024-06-13T10:00:00+02:00[Europe/Amsterdam]"
 * @example cutoffAt("2024-11-05T17:00:00Z", "PT96H", { timeZone: "America/New_York" }) // "2024-11-01T13:00:00-04:00[America/New_York]" (96 elapsed hours across the fall-back)
 * @example cutoffAt("2024-03-11T22:00:00Z", "P2D", { timeZone: "America/New_York", atLocalTime: "17:00" }) // "2024-03-09T17:00:00-05:00[America/New_York]" (17:00 local, across the spring-forward)
 * @example cutoffAt("2024-06-18T16:00:00Z", "P2D", { timeZone: "Europe/Amsterdam", atLocalTime: "17:00", calendar: { weekend: [6, 7], holidays: [], timeZone: "Europe/Amsterdam" } }) // "2024-06-14T17:00:00+02:00[Europe/Amsterdam]" (Sunday rolls back to Friday)
 * @example cutoffAt("2024-11-04T23:00:00Z", "P1D", { timeZone: "America/New_York", atLocalTime: "01:30" }) // "2024-11-03T01:30:00-04:00[America/New_York]" (a repeated hour takes the earlier pass)
 * @example cutoffAt("2024-03-11T22:00:00Z", "P1D", { timeZone: "America/New_York", atLocalTime: "02:30" }) // "" (02:30 on 10 March never happened)
 * @example cutoffAt("2024-06-14T18:00:00", "P2D", { timeZone: "Europe/Amsterdam" }) // "" (a zoneless anchor is not a moment)
 * @example cutoffAt("2024-06-14T16:00:00Z", "P2D", { timeZone: "Europe/Amsterdam", roll: "preceding" }) // "" (a roll needs a calendar)
 */
export function cutoffAt(
  anchor: string,
  offset: string,
  options: CutoffOptions,
): string {
  try {
    const resolved = resolveOptions(options);
    if (
      resolved === null ||
      !isValidInstant(anchor) ||
      !isValidDuration(offset)
    ) {
      return "";
    }

    try {
      const start = Temporal.Instant.from(anchor).toZonedDateTimeISO(
        resolved.timeZone,
      );
      const duration = Temporal.Duration.from(offset);

      if (resolved.atLocalTime !== null) {
        const day = rolledDate(
          start
            .subtract(timePart(duration))
            .toPlainDate()
            .subtract(datePart(duration)),
          resolved,
        );
        const pinned =
          day === null
            ? null
            : resolveWallTime(
                day.toPlainDateTime(resolved.atLocalTime),
                resolved.timeZone,
              );
        return pinned === null ? "" : pinned.toString();
      }

      const cutoff = subtractOffset(start, duration);
      if (cutoff === null) {
        return "";
      }
      const day = rolledDate(cutoff.toPlainDate(), resolved);
      if (day === null) {
        return "";
      }
      if (day.equals(cutoff.toPlainDate())) {
        return cutoff.toString();
      }
      const rolled = resolveWallTime(
        day.toPlainDateTime(cutoff.toPlainTime()),
        resolved.timeZone,
      );
      return rolled === null ? "" : rolled.toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
