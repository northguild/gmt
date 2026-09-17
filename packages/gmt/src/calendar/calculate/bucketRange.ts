import { Temporal } from "@js-temporal/polyfill";
import {
  nextZonedBucketStart,
  zonedNextTransition,
  zonedUnitStart,
} from "../../internal";
import { isValidInstant } from "../../precision/validate";
import type { ZoneBucketUnit } from "../../types";
import { isValidTimeZone } from "../../zoned/validate";
import { isValidZoneBucketUnit } from "../validate";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";

/**
 * Buckets a single call will return before giving up.
 *
 * Temporal's range runs to ±273,790 years, so an unbounded hour walk over it would exhaust
 * memory. This covers 416 days of hours, 27 years of days, 192 years of weeks or 833 years of
 * months — past anything a caller renders or aggregates in one pass.
 */
const MAX_BUCKETS = 10_000;

const NANOSECONDS_PER_HOUR = 3_600_000_000_000n;

/**
 * The longest wall-clock stretch of each unit. Any wall-clock interval this long holds a unit
 * start: an hour holds an hour start, 24 hours a midnight, 7 days a Monday, 31 days a first of
 * the month.
 */
const LONGEST_UNIT_NANOSECONDS: Readonly<Record<ZoneBucketUnit, bigint>> = {
  hour: NANOSECONDS_PER_HOUR,
  day: 24n * NANOSECONDS_PER_HOUR,
  week: 168n * NANOSECONDS_PER_HOUR,
  month: 744n * NANOSECONDS_PER_HOUR,
};

/** Offset transitions read before the pre-count gives up and leaves the answer to the walk. */
const MAX_PRECOUNT_TRANSITIONS = 4_096;

/**
 * True when `[start, end)` certainly touches more than `MAX_BUCKETS` buckets, decided from the span
 * instead of stepping bucket by bucket (which costs milliseconds a step in some zones).
 *
 * Over a prefix of the range, the local wall clock runs continuously between offset transitions.
 * Those stretches cover at least the prefix's length less every backward offset change, in at most
 * one stretch more than there are transitions, and each stretch of wall clock holds at least
 * `floor(length / LONGEST_UNIT_NANOSECONDS)` distinct unit starts, each the start of its own
 * bucket before `end`. The count subtracts two per stretch for the partial units at its ends.
 * `false` means "not certain": the walk decides, exactly as before.
 */
function certainlyExceedsBucketCap(
  startZoned: Temporal.ZonedDateTime,
  endZoned: Temporal.ZonedDateTime,
  unit: ZoneBucketUnit,
): boolean {
  const unitNs = LONGEST_UNIT_NANOSECONDS[unit];
  const startNs = startZoned.epochNanoseconds;
  const prefixEndNs = [
    endZoned.epochNanoseconds,
    startNs + 2n * BigInt(MAX_BUCKETS + 1) * unitNs,
  ].reduce((a, b) => (a < b ? a : b));
  if (prefixEndNs - startNs <= BigInt(MAX_BUCKETS) * unitNs) {
    return false;
  }
  let backwardNs = 0n;
  let transitions = 0;
  try {
    for (
      let current = startZoned, next = zonedNextTransition(current);
      next !== null && next.epochNanoseconds < prefixEndNs;
      current = next, next = zonedNextTransition(current)
    ) {
      if (++transitions > MAX_PRECOUNT_TRANSITIONS) {
        return false;
      }
      const shift = BigInt(current.offsetNanoseconds - next.offsetNanoseconds);
      backwardNs += shift > 0n ? shift : 0n;
    }
  } catch {
    return false;
  }
  const wallStarts = (prefixEndNs - startNs - backwardNs) / unitNs;
  return wallStarts - 2n * BigInt(transitions + 1) > BigInt(MAX_BUCKETS);
}

/**
 * The bucket start after `current`: `undefined` when it lies past Temporal's last representable
 * instant, null when the stepper cannot find it.
 */
function nextBucketStartWithinRange(
  current: Temporal.ZonedDateTime,
  unit: ZoneBucketUnit,
): Temporal.ZonedDateTime | null | undefined {
  try {
    return nextZonedBucketStart(current, unit);
  } catch (error) {
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}

/**
 * Return the start instant of every `unit` bucket the half-open range `[start, end)` touches,
 * bucketed **in `timeZone`**.
 *
 * This is "group by day in `America/New_York`" over UTC timestamps, done correctly. Buckets
 * are not uniform in length and that is the point: a day that springs forward is 23 hours and
 * one that falls back is 25, so a daily aggregate built on a fixed 24 hours drifts an hour
 * twice a year, and a container's chargeable days — counted in terminal-local calendar days —
 * come out wrong.
 *
 * - Each entry is a boundary `floorToZone` would return, so bucket *i* runs from `result[i]`
 *   up to (not including) `result[i + 1]`, and the last runs to the next boundary after it.
 * - The range is half-open: an `end` landing exactly on a boundary does not open that bucket.
 *   A zero-length range mid-bucket still returns the one bucket holding it; on a boundary it
 *   returns `[]`.
 * - Both endpoints are read in `timeZone`. Any bracketed zone they carry is ignored, as in
 *   `floorToZone`.
 * - Weeks start on Monday (ISO 8601). `unit` is the same four-unit set `floorToZone` takes,
 *   singular or plural, which `isValidZoneBucketUnit` narrows.
 * - A local boundary that does not exist is not invented: the day Samoa deleted crossing the
 *   date line is absent, a local day whose midnight is skipped starts at 01:00, and in a zone
 *   that falls back by half an hour the local 01:00 hour bucket is 90 minutes long.
 * - A bucket is returned when its start is representable, even if the bucket after it would
 *   start past Temporal's last instant (`+275760-09-13T00:00:00Z`).
 * - Returns `[]` on invalid input, when `start` is after `end`, when the range would need more
 *   than 10,000 buckets, when a boundary in it is not representable (see `floorToZone`), and
 *   if a zone ever presented more transitions inside one bucket than the stepper walks — no
 *   IANA zone does, and the whole table was swept to confirm it. A truncated list would be
 *   worse than the sentinel, so none is returned in any of those cases.
 *
 * @param start ISO 8601 instant string for the range start (inclusive)
 * @param end ISO 8601 instant string for the range end (exclusive)
 * @param unit bucket unit ("hour" | "day" | "week" | "month", or its plural)
 * @param timeZone IANA timeZone identifier the buckets are computed in
 * @returns array of UTC instant strings ending in "Z", or [] on invalid input
 *
 * @example bucketRange("2024-06-15T03:00:00Z", "2024-06-17T03:00:00Z", "day", "America/New_York") // ["2024-06-14T04:00:00Z", "2024-06-15T04:00:00Z", "2024-06-16T04:00:00Z"]
 * @example bucketRange("2024-03-09T05:00:00Z", "2024-03-12T04:00:00Z", "day", "America/New_York") // ["2024-03-09T05:00:00Z", "2024-03-10T05:00:00Z", "2024-03-11T04:00:00Z"] (the middle day is 23 hours)
 * @example bucketRange("2024-11-02T04:00:00Z", "2024-11-05T05:00:00Z", "day", "America/New_York") // ["2024-11-02T04:00:00Z", "2024-11-03T04:00:00Z", "2024-11-04T05:00:00Z"] (the middle day is 25 hours)
 * @example bucketRange("2024-11-03T04:00:00Z", "2024-11-03T08:00:00Z", "hour", "America/New_York") // ["2024-11-03T04:00:00Z", "2024-11-03T05:00:00Z", "2024-11-03T06:00:00Z", "2024-11-03T07:00:00Z"] (the repeated 01:00 is its own bucket)
 * @example bucketRange("2024-06-14T04:00:00Z", "2024-06-14T04:00:00Z", "day", "America/New_York") // [] (zero length, on a boundary)
 * @example bucketRange("+275760-09-12T23:00:00Z", "+275760-09-13T00:00:00Z", "day", "America/New_York") // ["+275760-09-12T04:00:00Z"] (the next day would start past the last instant; this one is still returned)
 * @example bucketRange("2024-06-16T00:00:00Z", "2024-06-15T00:00:00Z", "day", "UTC") // [] (start after end)
 * @example bucketRange("2024-06-15T03:00:00Z", "2024-06-17T03:00:00Z", "days", "America/New_York") // ["2024-06-14T04:00:00Z", "2024-06-15T04:00:00Z", "2024-06-16T04:00:00Z"] (plural unit name)
 * @example bucketRange("2024-06-15T03:00:00Z", "2024-06-17T03:00:00Z", "year", "UTC") // [] (not a bucketing unit)
 */
export function bucketRange(
  start: string,
  end: string,
  unit: Temporal.SmallestUnit<ZoneBucketUnit>,
  timeZone: string,
): string[] {
  // The singular name; the guard below rejects anything outside the four units.
  const resolvedUnit = resolveDateTimeUnit(unit) as ZoneBucketUnit;

  if (
    !isValidInstant(start) ||
    !isValidInstant(end) ||
    !isValidZoneBucketUnit(resolvedUnit) ||
    !isValidTimeZone(timeZone)
  ) {
    return [];
  }

  try {
    const startZoned =
      Temporal.Instant.from(start).toZonedDateTimeISO(timeZone);
    const endZoned = Temporal.Instant.from(end).toZonedDateTimeISO(timeZone);

    if (Temporal.ZonedDateTime.compare(startZoned, endZoned) > 0) return [];
    if (certainlyExceedsBucketCap(startZoned, endZoned, resolvedUnit))
      return [];

    const boundaries: string[] = [];
    const first = zonedUnitStart(startZoned, resolvedUnit);
    if (!first) return [];

    let current = first;

    for (let i = 0; i < MAX_BUCKETS; i++) {
      if (Temporal.ZonedDateTime.compare(current, endZoned) >= 0) {
        return boundaries;
      }

      boundaries.push(current.toInstant().toString());

      const next = nextBucketStartWithinRange(current, resolvedUnit);
      // Past the last representable instant, so after `end`: every touched bucket is collected.
      if (next === undefined) return boundaries;
      if (!next) return [];

      current = next;
    }

    // `MAX_BUCKETS` boundaries are collected; the range fit only if the next one clears `end`.
    return Temporal.ZonedDateTime.compare(current, endZoned) >= 0
      ? boundaries
      : [];
  } catch {
    return [];
  }
}
