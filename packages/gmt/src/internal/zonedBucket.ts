import { Temporal } from "@js-temporal/polyfill";
import type { ZoneBucketUnit } from "../types";

/** `ZoneBucketUnit` to the `Temporal.Duration` field that advances by one of it. */
const DURATION_FIELD_BY_BUCKET_UNIT = {
  hour: "hours",
  day: "days",
  week: "weeks",
  month: "months",
} as const satisfies Record<ZoneBucketUnit, string>;

/** Wall-clock fields that a local day, week or month boundary resets. */
const MIDNIGHT = {
  hour: 0,
  minute: 0,
  second: 0,
  millisecond: 0,
  microsecond: 0,
  nanosecond: 0,
} as const;

/**
 * Transitions walked over while sizing one bucket.
 *
 * Only transitions inside the bucket matter, and no IANA zone has ever had two inside one
 * local hour, day, week or month.
 */
const MAX_TRANSITION_WALKBACK = 4;

/** Truncate a wall clock to the start of its `unit`. Pure wall-clock arithmetic. */
function truncateLocal(
  local: Temporal.PlainDateTime,
  unit: ZoneBucketUnit,
): Temporal.PlainDateTime {
  switch (unit) {
    case "hour":
      return local.with({
        minute: 0,
        second: 0,
        millisecond: 0,
        microsecond: 0,
        nanosecond: 0,
      });
    case "day":
      return local.with(MIDNIGHT);
    case "week":
      return local.subtract({ days: local.dayOfWeek - 1 }).with(MIDNIGHT);
    default:
      return local.with({ day: 1, ...MIDNIGHT });
  }
}

/** The local `unit` label `zoned` carries — what the wall clock read, with no zone opinion. */
function localUnitLabel(
  zoned: Temporal.ZonedDateTime,
  unit: ZoneBucketUnit,
): string {
  return truncateLocal(zoned.toPlainDateTime(), unit).toString();
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
  unit: ZoneBucketUnit,
): Temporal.ZonedDateTime {
  const local = zoned.toPlainDateTime();
  const elapsed = truncateLocal(local, unit).until(local, {
    largestUnit: "hour",
  });

  return zoned
    .toInstant()
    .subtract(elapsed)
    .toZonedDateTimeISO(zoned.timeZoneId);
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
  unit: ZoneBucketUnit,
): boolean {
  const local = transition.toPlainDateTime();
  if (truncateLocal(local, unit).equals(local)) return true;

  try {
    return (
      localUnitLabel(transition.subtract({ nanoseconds: 1 }), unit) !==
      localUnitLabel(transition, unit)
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
 */
export function zonedUnitStart(
  zoned: Temporal.ZonedDateTime,
  unit: ZoneBucketUnit,
): Temporal.ZonedDateTime {
  let start = boundaryInOwnOffset(zoned, unit);
  let cursor = zoned;

  for (let i = 0; i < MAX_TRANSITION_WALKBACK; i++) {
    const transition = transitionAtOrBefore(cursor);

    if (!transition || Temporal.ZonedDateTime.compare(transition, start) <= 0) {
      break;
    }

    if (startsNewBucketAt(transition, unit)) return transition;

    // The bucket runs through this transition, so it reaches into the older offset.
    const justBefore = transition.subtract({ nanoseconds: 1 });
    start = boundaryInOwnOffset(justBefore, unit);
    cursor = justBefore;
  }

  return start;
}

/**
 * The next `unit` boundary after `zoned`, reached without leaving its own offset stretch.
 */
function nextBoundaryInOwnOffset(
  zoned: Temporal.ZonedDateTime,
  unit: ZoneBucketUnit,
): Temporal.ZonedDateTime {
  const local = zoned.toPlainDateTime();
  const remaining = local.until(
    truncateLocal(local, unit).add({
      [DURATION_FIELD_BY_BUCKET_UNIT[unit]]: 1,
    }),
    { largestUnit: "hour" },
  );

  return zoned.toInstant().add(remaining).toZonedDateTimeISO(zoned.timeZoneId);
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
 * - Returns null if neither is reachable within `MAX_TRANSITION_WALKBACK` transitions, which
 *   no IANA zone comes close to.
 */
export function nextZonedBucketStart(
  current: Temporal.ZonedDateTime,
  unit: ZoneBucketUnit,
): Temporal.ZonedDateTime | null {
  let cursor = current;

  for (let i = 0; i < MAX_TRANSITION_WALKBACK; i++) {
    const boundary = nextBoundaryInOwnOffset(cursor, unit);
    const transition = cursor.getTimeZoneTransition("next");

    if (
      !transition ||
      Temporal.ZonedDateTime.compare(transition, boundary) > 0
    ) {
      return boundary;
    }

    if (startsNewBucketAt(transition, unit)) return transition;

    // The bucket runs through this transition; measure the rest of it in the new offset.
    cursor = transition;
  }

  return null;
}
