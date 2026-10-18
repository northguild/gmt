import { Temporal } from "../../internal/temporal";
import {
  frameInstant,
  frameZoned,
  instantFrom,
  nextZonedBucketStart,
  zonedUnitStart,
  zoneFrame,
} from "../../internal";
import { isValidInstant } from "../../precision/validate";
import type { ZoneBucketUnit } from "../../types";
import { isValidZoneBucketUnit } from "../validate";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { certainlyTouchesMoreBuckets } from "../../internal/zoneBucketCap";

/**
 * Buckets a single call will return before giving up.
 *
 * Temporal's range runs to ±273,790 years, so an unbounded hour walk over it would exhaust
 * memory. This covers 416 days of hours, 27 years of days, 192 years of weeks or 833 years of
 * months — past anything a caller renders or aggregates in one pass.
 */
const MAX_BUCKETS = 10_000;

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
 * This is "group by day in `Europe/London`" over UTC timestamps, done correctly. Buckets
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
 * - Both endpoints are read in `timeZone`. A bracketed zone they carry never supplies the
 *   zone, as in `floorToZone`.
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
 * - **Limit at an offset with seconds.** The instant is placed in the offset's whole-minute zone,
 *   moved by its seconds, and the moved instant must be inside Temporal's range. So within the
 *   offset's seconds (under a minute) of the last instant Temporal supports
 *   (`+275760-09-13T00:00:00Z`) for an offset east of UTC, or of the first
 *   (`-271821-04-20T00:00:00Z`) for one west, this returns `[]`. An offset to the minute has no
 *   such limit.
 *
 * @param start ISO 8601 instant string for the range start (inclusive)
 * @param end ISO 8601 instant string for the range end (exclusive)
 * @param unit bucket unit ("month" | "week" | "day" | "hour", or its plural)
 * @param timeZone IANA name or UTC offset the buckets are computed in: a time zone identifier
 *   (`+05:30`, `+0530`, `-08`) or a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @returns array of UTC instant strings ending in "Z", or [] on invalid input
 *
 * @example bucketRange("2024-06-15T03:00:00Z", "2024-06-17T03:00:00Z", "day", "Asia/Kolkata") // ["2024-06-14T18:30:00Z", "2024-06-15T18:30:00Z", "2024-06-16T18:30:00Z"]
 * @example bucketRange("2024-03-30T00:00:00Z", "2024-04-01T23:00:00Z", "day", "Europe/London") // ["2024-03-30T00:00:00Z", "2024-03-31T00:00:00Z", "2024-03-31T23:00:00Z"] (the middle day is 23 hours)
 * @example bucketRange("2024-04-05T13:00:00Z", "2024-04-08T14:00:00Z", "day", "Australia/Sydney") // ["2024-04-05T13:00:00Z", "2024-04-06T13:00:00Z", "2024-04-07T14:00:00Z"] (the middle day is 25 hours)
 * @example bucketRange("2024-04-06T14:00:00Z", "2024-04-06T18:00:00Z", "hour", "Australia/Sydney") // ["2024-04-06T14:00:00Z", "2024-04-06T15:00:00Z", "2024-04-06T16:00:00Z", "2024-04-06T17:00:00Z"] (the repeated 02:00 is its own bucket)
 * @example bucketRange("2024-06-14T15:00:00Z", "2024-06-14T15:00:00Z", "day", "Asia/Tokyo") // [] (zero length, on a boundary)
 * @example bucketRange("+275760-09-12T23:00:00Z", "+275760-09-13T00:00:00Z", "day", "America/Sao_Paulo") // ["+275760-09-12T03:00:00Z"] (the next day would start past the last instant; this one is still returned)
 * @example bucketRange("2024-06-16T00:00:00Z", "2024-06-15T00:00:00Z", "day", "UTC") // [] (start after end)
 * @example bucketRange("2024-06-15T03:00:00Z", "2024-06-17T03:00:00Z", "days", "Asia/Tokyo") // ["2024-06-14T15:00:00Z", "2024-06-15T15:00:00Z", "2024-06-16T15:00:00Z"] (plural unit name)
 * @example bucketRange("2024-06-15T03:00:00Z", "2024-06-17T03:00:00Z", "year", "UTC") // [] (not a bucketing unit)
 * @example bucketRange("1970-01-01T00:00:00Z", "1970-01-02T01:00:00Z", "day", "-00:44:30") // ["1969-12-31T00:44:30Z", "1970-01-01T00:44:30Z", "1970-01-02T00:44:30Z"]
 */
export function bucketRange(
  start: string,
  end: string,
  unit: Temporal.SmallestUnit<ZoneBucketUnit>,
  timeZone: string,
): string[] {
  // The singular name; the guard below rejects anything outside the four units.
  const resolvedUnit = resolveDateTimeUnit(unit) as ZoneBucketUnit;

  const frame = zoneFrame(timeZone);

  if (
    !isValidInstant(start) ||
    !isValidInstant(end) ||
    !isValidZoneBucketUnit(resolvedUnit) ||
    frame === null
  ) {
    return [];
  }

  try {
    const startZoned = frameZoned(instantFrom(start), frame);
    const endZoned = frameZoned(instantFrom(end), frame);

    if (Temporal.ZonedDateTime.compare(startZoned, endZoned) > 0) return [];
    if (
      certainlyTouchesMoreBuckets(
        startZoned,
        endZoned,
        resolvedUnit,
        MAX_BUCKETS,
      )
    )
      return [];

    const boundaries: string[] = [];
    const first = zonedUnitStart(startZoned, resolvedUnit);
    if (!first) return [];

    let current = first;

    for (let i = 0; i < MAX_BUCKETS; i++) {
      if (Temporal.ZonedDateTime.compare(current, endZoned) >= 0) {
        return boundaries;
      }

      boundaries.push(frameInstant(current, frame).toString());

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
