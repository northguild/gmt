import { Temporal } from "@js-temporal/polyfill";
import type { DateTimeUnit } from "../types";

/**
 * ISO day-of-week a week starts on: 1 = Monday .. 7 = Sunday, as `Temporal`'s `dayOfWeek` reads.
 */
export type WeekStartDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** `DateTimeUnit` to the `Temporal.Duration` field that advances by one of it. */
const DURATION_FIELD_BY_UNIT = {
  year: "years",
  month: "months",
  week: "weeks",
  day: "days",
  hour: "hours",
  minute: "minutes",
  second: "seconds",
  millisecond: "milliseconds",
  microsecond: "microseconds",
  nanosecond: "nanoseconds",
} as const satisfies Record<DateTimeUnit, string>;

/** Wall-clock fields that a local day, week, month or year boundary resets. */
const MIDNIGHT = {
  hour: 0,
  minute: 0,
  second: 0,
  millisecond: 0,
  microsecond: 0,
  nanosecond: 0,
} as const;

/**
 * Wall-clock fields each unit's boundary resets. `week` is computed from the week start, and
 * `nanosecond` resets nothing, so neither is listed.
 */
const FIELDS_RESET_BY_UNIT = {
  year: { month: 1, day: 1, ...MIDNIGHT },
  month: { day: 1, ...MIDNIGHT },
  day: MIDNIGHT,
  hour: { minute: 0, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 },
  minute: { second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 },
  second: { millisecond: 0, microsecond: 0, nanosecond: 0 },
  millisecond: { microsecond: 0, nanosecond: 0 },
  microsecond: { nanosecond: 0 },
} as const satisfies Record<
  Exclude<DateTimeUnit, "week" | "nanosecond">,
  Temporal.PlainDateTimeLike
>;

/**
 * Transitions walked over while sizing one bucket.
 *
 * Only transitions inside the bucket matter. No IANA zone has had more than two inside one
 * local month, but `Africa/Cairo` had four inside local 2010 (DST, suspended for Ramadan, then
 * resumed and ended), and the walk needs one step past the last of them to see it has left
 * the bucket — so the bound sits comfortably above five.
 */
const MAX_TRANSITION_WALKBACK = 8;

/**
 * Truncate a wall clock to the start of its `unit`. Pure wall-clock arithmetic.
 *
 * Calendar-aware: `local` keeps its calendar, so a Hebrew month or year truncates to the
 * Hebrew one.
 */
function truncateLocal(
  local: Temporal.PlainDateTime,
  unit: DateTimeUnit,
  weekStartsOn: WeekStartDay,
): Temporal.PlainDateTime {
  if (unit === "nanosecond") return local;

  if (unit === "week") {
    return local
      .subtract({ days: (local.dayOfWeek - weekStartsOn + 7) % 7 })
      .with(MIDNIGHT);
  }

  return local.with(FIELDS_RESET_BY_UNIT[unit]);
}

/** The local `unit` label `zoned` carries — what the wall clock read, with no zone opinion. */
function localUnitLabel(
  zoned: Temporal.ZonedDateTime,
  unit: DateTimeUnit,
  weekStartsOn: WeekStartDay,
): string {
  return truncateLocal(zoned.toPlainDateTime(), unit, weekStartsOn).toString();
}

/** `instant` in `like`'s zone and calendar. `toZonedDateTimeISO` alone would drop the calendar. */
function inZoneOf(
  instant: Temporal.Instant,
  like: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime {
  return instant
    .toZonedDateTimeISO(like.timeZoneId)
    .withCalendar(like.calendarId);
}

/**
 * The `unit` boundary reached from `zoned` without leaving its own offset stretch.
 *
 * The wall clock says how far into the unit `zoned` sits; that distance is then subtracted as
 * exact time, so the result keeps `zoned`'s offset instead of being re-resolved — which is
 * what stops a repeated wall time from being answered with the wrong pass of it.
 */
function boundaryInOwnOffset(
  zoned: Temporal.ZonedDateTime,
  unit: DateTimeUnit,
  weekStartsOn: WeekStartDay,
): Temporal.ZonedDateTime {
  const local = zoned.toPlainDateTime();
  const elapsed = truncateLocal(local, unit, weekStartsOn).until(local, {
    largestUnit: "hour",
  });

  return inZoneOf(zoned.toInstant().subtract(elapsed), zoned);
}

/** The most recent zone transition at or before `zoned`, or null if there is none. */
function transitionAtOrBefore(
  zoned: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime | null {
  try {
    // `getTimeZoneTransition("previous")` is strict, so a transition sitting exactly on
    // `zoned` is only found by asking from a nanosecond later.
    return zoned.add({ nanoseconds: 1 }).getTimeZoneTransition("previous");
  } catch {
    return null;
  }
}

/**
 * True when the local `unit` bucket restarts at `transition` rather than continuing through it.
 *
 * Two ways a bucket can open at a transition, and the difference is exactly what separates
 * New York from Lord Howe on a fall-back morning:
 *
 * - **The clock lands on a unit boundary.** New York goes back to 01:00:00 exactly, so a
 *   second, separate 01:00 hour begins there — which is why a fall-back day has 25 hour
 *   buckets. `Australia/Lord_Howe` goes back to 01:30, mid-hour, so the hour it is already in
 *   simply runs longer: 90 minutes.
 * - **The label changes discontinuously.** `Pacific/Chatham` jumps 02:45 → 03:45, so the
 *   03:00 hour begins at the transition even though the clock does not read 03:00:00; and a
 *   local day whose midnight is skipped begins at 01:00 the same way.
 */
function startsNewBucketAt(
  transition: Temporal.ZonedDateTime,
  unit: DateTimeUnit,
  weekStartsOn: WeekStartDay,
): boolean {
  const local = transition.toPlainDateTime();
  if (truncateLocal(local, unit, weekStartsOn).equals(local)) return true;

  try {
    return (
      localUnitLabel(
        transition.subtract({ nanoseconds: 1 }),
        unit,
        weekStartsOn,
      ) !== localUnitLabel(transition, unit, weekStartsOn)
    );
  } catch {
    return true;
  }
}

/**
 * Return the instant the local `unit` containing `zoned` began — the bucket `zoned` falls in.
 *
 * A bucket is the run of instants sharing `zoned`'s local label *without interruption*, so
 * this walks back from `zoned` to where that run started. Re-resolving a truncated wall clock
 * cannot do the job, because truncation can land on a local time the zone never had and
 * Temporal's "compatible" disambiguation then relocates it:
 *
 * - **A gap pushes the boundary past the instant being floored.** `Pacific/Chatham` springs
 *   forward 02:45 → 03:45, so local 03:00 never happens; truncating 03:45 to the hour and
 *   resolving it lands fifteen minutes *after* the instant it was asked to floor.
 *   `Antarctica/Casey`'s three-hour 2020 jump lands three hours after.
 * - **A sub-hour fall-back answers with the wrong pass.** Chatham falls back 03:45 → 02:45,
 *   so local 02:00 and local 03:00 each name two instants an hour and three quarters apart,
 *   and "compatible" always picks the earlier — silently skipping a boundary.
 *
 * So the boundary is taken in `zoned`'s own offset, then extended back through any transition
 * the bucket runs straight through. See `startsNewBucketAt` for which those are.
 *
 * - Handles every `DateTimeUnit`. Sub-hour units need the same own-offset treatment, because
 *   historic offsets carry seconds (`Africa/Monrovia` ran at −00:44:30 until 1972).
 * - Weeks start on `weekStartsOn` (ISO day number, Monday by default).
 * - Keeps `zoned`'s calendar, so a non-ISO month or year floors in that calendar.
 * - Returns null if the walk-back is still inside transitions after `MAX_TRANSITION_WALKBACK`
 *   of them, which no IANA zone comes close to. The last `start` reached at that point is
 *   only a partial answer, and a bounded walk that runs out answers with the sentinel.
 */
export function zonedUnitStart(
  zoned: Temporal.ZonedDateTime,
  unit: DateTimeUnit,
  weekStartsOn: WeekStartDay = 1,
): Temporal.ZonedDateTime | null {
  let start = boundaryInOwnOffset(zoned, unit, weekStartsOn);
  let cursor = zoned;

  for (let i = 0; i < MAX_TRANSITION_WALKBACK; i++) {
    const transition = transitionAtOrBefore(cursor);

    if (!transition || Temporal.ZonedDateTime.compare(transition, start) <= 0) {
      return start;
    }

    if (startsNewBucketAt(transition, unit, weekStartsOn)) return transition;

    // The bucket runs through this transition, so it reaches into the older offset.
    const justBefore = transition.subtract({ nanoseconds: 1 });
    start = boundaryInOwnOffset(justBefore, unit, weekStartsOn);
    cursor = justBefore;
  }

  return null;
}

/**
 * The next `unit` boundary after `zoned`, reached without leaving its own offset stretch.
 */
function nextBoundaryInOwnOffset(
  zoned: Temporal.ZonedDateTime,
  unit: DateTimeUnit,
  weekStartsOn: WeekStartDay,
): Temporal.ZonedDateTime {
  const local = zoned.toPlainDateTime();
  const remaining = local.until(
    truncateLocal(local, unit, weekStartsOn).add({
      [DURATION_FIELD_BY_UNIT[unit]]: 1,
    }),
    { largestUnit: "hour" },
  );

  return inZoneOf(zoned.toInstant().add(remaining), zoned);
}

/**
 * Return the start of the bucket following the one starting at `current`.
 *
 * Stepping a whole unit and re-flooring is wrong, because a bucket can be shorter than its
 * unit and would be stepped straight over: `Pacific/Chatham`'s 02:45 → 03:45 spring-forward
 * leaves a local 03:00 hour only fifteen minutes long. So this takes whichever comes first —
 * the next boundary in the current offset, or a transition that opens a bucket of its own —
 * and runs through any transition that does not.
 *
 * - Handles every `DateTimeUnit`, weeks starting on `weekStartsOn` (Monday by default).
 * - Returns null if neither is reachable within `MAX_TRANSITION_WALKBACK` transitions, which
 *   no IANA zone comes close to.
 */
export function nextZonedBucketStart(
  current: Temporal.ZonedDateTime,
  unit: DateTimeUnit,
  weekStartsOn: WeekStartDay = 1,
): Temporal.ZonedDateTime | null {
  let cursor = current;

  for (let i = 0; i < MAX_TRANSITION_WALKBACK; i++) {
    const boundary = nextBoundaryInOwnOffset(cursor, unit, weekStartsOn);
    const transition = cursor.getTimeZoneTransition("next");

    if (
      !transition ||
      Temporal.ZonedDateTime.compare(transition, boundary) > 0
    ) {
      return boundary;
    }

    if (startsNewBucketAt(transition, unit, weekStartsOn)) {
      return transition.withCalendar(current.calendarId);
    }

    // The bucket runs through this transition; measure the rest of it in the new offset.
    cursor = transition.withCalendar(current.calendarId);
  }

  return null;
}

/**
 * Return the last instant of the local `unit` containing `zoned`: one nanosecond before the
 * next bucket starts.
 *
 * - Never earlier than `zoned`, because it is measured from the real bucket `zoned` is in —
 *   New York's second 01:00 hour on a fall-back morning ends at 01:59:59.999999999 −05:00, not
 *   at the first pass's.
 * - Returns null if either the bucket start or the next one cannot be found.
 */
export function zonedUnitEnd(
  zoned: Temporal.ZonedDateTime,
  unit: DateTimeUnit,
  weekStartsOn: WeekStartDay = 1,
): Temporal.ZonedDateTime | null {
  const start = zonedUnitStart(zoned, unit, weekStartsOn);
  if (!start) return null;

  const next = nextZonedBucketStart(start, unit, weekStartsOn);
  return next ? next.subtract({ nanoseconds: 1 }) : null;
}

/**
 * Transitions walked while counting buckets across a span.
 *
 * Counting visits every zone transition inside the span, never every bucket, so an hour count
 * across centuries stays cheap. 10,000 transitions is roughly 5,000 years of twice-yearly
 * daylight saving — past anything counted in one call — and keeps the worst case near a
 * second; a longer walk answers with the sentinel rather than running unbounded.
 */
const MAX_COUNTED_TRANSITIONS = 10_000;

/** Whole `unit`s between two wall clocks already truncated to `unit`. */
function unitsBetween(
  from: Temporal.PlainDateTime,
  to: Temporal.PlainDateTime,
  unit: DateTimeUnit,
): number {
  return Math.floor(
    from.until(to, { largestUnit: unit })[DURATION_FIELD_BY_UNIT[unit]],
  );
}

/**
 * Count the local `unit` buckets the half-open interval `[start, end)` touches, in `start`'s
 * zone and calendar. `end` must already be expressed in both.
 *
 * The count is the bucket `start` is in, plus every bucket that starts after it and at or
 * before `end` — less one when `end` sits exactly on a bucket start, since the interval does
 * not reach into that bucket. A calendar-unit difference between truncated endpoints gets
 * transitions wrong both ways: Chatham's 15-minute 03:00 hour is a bucket the difference
 * never sees, and Samoa's deleted 2011-12-30 is a day the difference counts anyway.
 *
 * - Between transitions the wall clock runs continuously, so buckets there are counted by the
 *   whole-unit difference of their local labels.
 * - A transition that does not open a bucket (see `startsNewBucketAt`) leaves the label
 *   running on, so it changes nothing and is stepped over.
 * - A transition that does open one closes the run before it and counts the new bucket.
 * - Returns null if either endpoint's bucket cannot be found, or the span crosses more than
 *   `MAX_COUNTED_TRANSITIONS` transitions.
 */
export function countZonedBuckets(
  start: Temporal.ZonedDateTime,
  end: Temporal.ZonedDateTime,
  unit: DateTimeUnit,
  weekStartsOn: WeekStartDay = 1,
): number | null {
  const startOfStart = zonedUnitStart(start, unit, weekStartsOn);
  const startOfEnd = zonedUnitStart(end, unit, weekStartsOn);

  if (!startOfStart || !startOfEnd) return null;

  const label = (zoned: Temporal.ZonedDateTime) =>
    truncateLocal(zoned.toPlainDateTime(), unit, weekStartsOn);
  const reachesIntoEndBucket =
    Temporal.ZonedDateTime.compare(startOfEnd, end) === 0 ? 0 : 1;

  let spanned = 0;
  let runStart = startOfStart;
  let cursor = startOfStart;

  for (let i = 0; i < MAX_COUNTED_TRANSITIONS; i++) {
    const transition =
      cursor.getTimeZoneTransition("next")?.withCalendar(start.calendarId) ??
      null;

    if (
      !transition ||
      Temporal.ZonedDateTime.compare(transition, startOfEnd) > 0
    ) {
      return (
        spanned +
        unitsBetween(label(runStart), label(startOfEnd), unit) +
        reachesIntoEndBucket
      );
    }

    if (startsNewBucketAt(transition, unit, weekStartsOn)) {
      spanned +=
        unitsBetween(
          label(runStart),
          label(transition.subtract({ nanoseconds: 1 })),
          unit,
        ) + 1;
      runStart = transition;
    }

    cursor = transition;
  }

  return null;
}
