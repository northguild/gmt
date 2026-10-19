import { Temporal } from "./temporal";
import {
  parseBusinessCalendar,
  type ResolvedBusinessCalendar,
} from "./businessCalendar";
import { rollBusinessDate } from "./rollBusinessDate";
import { earlierOccurrence } from "./earlierOccurrence";
import { isRollConventionName, isTimeString, isZoneId } from "./inputChecks";
import { zoneFrame, type ZoneFrame } from "./zoneFrame";
import type { RollConvention } from "../types";

/**
 * What every cut-off in a stack shares: the zone it is read in and, when it rolls, the parsed
 * calendar and the convention. `rolling` is present exactly when a calendar and a convention
 * are.
 */
export type SharedCutoffOptions = {
  timeZone: string;
  /** The zone built once, so a wall time never re-parses it. */
  frame: ZoneFrame;
  rolling: { calendar: ResolvedBusinessCalendar; roll: RollConvention } | null;
};

/**
 * Validate the options a whole stack shares, parsing the calendar once.
 *
 * @param timeZone the zone the cut-offs are read in
 * @param calendar the working week and holidays, or `undefined`
 * @param roll the roll convention, or `undefined`
 * @returns the shared options, or `null` when any is invalid, or only one of `calendar` and
 * `roll` is given (no standard supplies either one by default)
 *
 * @example resolveSharedCutoffOptions("Europe/Amsterdam", undefined, undefined) // { timeZone: "Europe/Amsterdam", rolling: null }
 * @example resolveSharedCutoffOptions("Europe/Amsterdam", undefined, "preceding") // null (a roll needs a calendar)
 * @example resolveSharedCutoffOptions("Not/AZone", undefined, undefined) // null
 */
export function resolveSharedCutoffOptions(
  timeZone: unknown,
  calendar: unknown,
  roll: unknown,
): SharedCutoffOptions | null {
  if (typeof timeZone !== "string" || !isZoneId(timeZone)) {
    return null;
  }
  const frame = zoneFrame(timeZone);
  if (frame === null) {
    return null;
  }
  const parsed =
    calendar === undefined ? null : parseBusinessCalendar(calendar);
  if (calendar !== undefined && parsed === null) {
    return null;
  }
  if (roll !== undefined && !isRollConventionName(roll)) {
    return null;
  }
  // Rolling needs both a calendar and a direction, and no standard supplies either one by
  // default: a calendar without a roll, or a roll without a calendar, is a missing term.
  if ((calendar === undefined) !== (roll === undefined)) {
    return null;
  }
  return {
    timeZone,
    frame,
    rolling:
      parsed === null || roll === undefined
        ? null
        : { calendar: parsed, roll: roll as RollConvention },
  };
}

/**
 * Validate an entry's local time of day.
 *
 * @param atLocalTime the local time of day, or `undefined` for none
 * @returns `{ time }` (`time` is `null` for none), or `null` when it is not a valid time
 *
 * @example resolveCutoffTime("17:00") // { time: PlainTime 17:00 }
 * @example resolveCutoffTime(undefined) // { time: null }
 * @example resolveCutoffTime("25:00") // null
 */
export function resolveCutoffTime(
  atLocalTime: unknown,
): { time: Temporal.PlainTime | null } | null {
  if (atLocalTime === undefined) {
    return { time: null };
  }
  if (typeof atLocalTime !== "string" || !isTimeString(atLocalTime)) {
    return null;
  }
  return { time: Temporal.PlainTime.from(atLocalTime) };
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
  frame: ZoneFrame,
): Temporal.ZonedDateTime | null {
  const calendarPart = datePart(offset);
  if (calendarPart.blank) {
    return anchor.subtract(timePart(offset));
  }
  const wall = earlierOccurrence(
    anchor.toPlainDateTime().subtract(calendarPart),
    frame,
  );
  return wall === null ? null : wall.subtract(timePart(offset));
}

/**
 * The local date the cut-off falls on after rolling, or `null` when the roll fails. With no
 * calendar the date is left as it is.
 */
function rolledDate(
  date: Temporal.PlainDate,
  shared: SharedCutoffOptions,
): Temporal.PlainDate | null {
  if (shared.rolling === null) {
    return date;
  }
  const { calendar, roll } = shared.rolling;
  try {
    return rollBusinessDate(date, roll, calendar);
  } catch {
    return null;
  }
}

/**
 * One cut-off over options already validated: the deadline `duration` before `anchor`, as
 * `cutoffAt` defines it.
 *
 * @param anchor the event the deadline counts back from
 * @param duration the offset before the anchor
 * @param atLocalTime the local time of day to pin to, or `null` for none
 * @param shared the zone and roll the whole stack shares
 * @returns the cut-off as a zoned string and its epoch nanoseconds, or `null` when it falls in
 * a skipped local hour or the roll runs out
 *
 * @example cutoffAtResolved(Temporal.Instant.from("2024-06-14T16:00:00Z"), Temporal.Duration.from("P2D"), Temporal.PlainTime.from("17:00"), { timeZone: "Europe/Amsterdam", rolling: null })?.text // "2024-06-12T17:00:00+02:00[Europe/Amsterdam]"
 */
export function cutoffAtResolved(
  anchor: Temporal.Instant,
  duration: Temporal.Duration,
  atLocalTime: Temporal.PlainTime | null,
  shared: SharedCutoffOptions,
): { text: string; ns: bigint } | null {
  try {
    const found = cutoffZoned(
      anchor.toZonedDateTimeISO(shared.timeZone),
      duration,
      atLocalTime,
      shared,
    );
    return found === null
      ? null
      : { text: found.toString(), ns: found.epochNanoseconds };
  } catch {
    return null;
  }
}

function cutoffZoned(
  start: Temporal.ZonedDateTime,
  duration: Temporal.Duration,
  atLocalTime: Temporal.PlainTime | null,
  shared: SharedCutoffOptions,
): Temporal.ZonedDateTime | null {
  if (atLocalTime !== null) {
    const day = rolledDate(
      start
        .subtract(timePart(duration))
        .toPlainDate()
        .subtract(datePart(duration)),
      shared,
    );
    return day === null
      ? null
      : earlierOccurrence(day.toPlainDateTime(atLocalTime), shared.frame);
  }

  const cutoff = subtractOffset(start, duration, shared.frame);
  if (cutoff === null) {
    return null;
  }
  const day = rolledDate(cutoff.toPlainDate(), shared);
  if (day === null) {
    return null;
  }
  if (day.equals(cutoff.toPlainDate())) {
    return cutoff;
  }
  return earlierOccurrence(
    day.toPlainDateTime(cutoff.toPlainTime()),
    shared.frame,
  );
}
