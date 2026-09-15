import { Temporal } from "@js-temporal/polyfill";
import { getUnitSpan, resolveDateTimeUnit } from "../../internal";
import {
  getStartOfDateTimeUnit,
  getStartOfNextDateTimeUnit,
} from "../../internal/dateTimeUnitHelpers";
import { plainDateTime } from "../../regex";
import type { DateTimeUnit } from "../../types";
import {
  isValidDateTime,
  isValidDateTimeUnit,
  isValidDateUnit,
} from "../validate";

/** One of each time unit, for stepping to the next time-unit bucket. */
const ONE_TIME_UNIT: Readonly<Record<string, Temporal.DurationLike>> = {
  hour: { hours: 1 },
  minute: { minutes: 1 },
  second: { seconds: 1 },
  millisecond: { milliseconds: 1 },
  microsecond: { microseconds: 1 },
  nanosecond: { nanoseconds: 1 },
};

/**
 * Return the start of `unit` for a `Temporal.PlainDateTime`, for every DateTimeUnit, or null when
 * it lies before the representable range (the first PlainDateTime is
 * `-271821-04-19T00:00:00.000000001`, so even that date's midnight does not exist).
 *
 * Date units delegate to the shared helper; time units truncate via `round`.
 */
function startOfUnitIfRepresentable(
  source: Temporal.PlainDateTime,
  unit: DateTimeUnit,
): Temporal.PlainDateTime | null {
  try {
    if (isValidDateUnit(unit)) {
      return getStartOfDateTimeUnit(source, unit);
    }

    return source.round({ smallestUnit: unit, roundingMode: "trunc" });
  } catch {
    return null;
  }
}

/**
 * Return the start of the `unit` after the one holding `source`: step first, truncate after, so
 * `source`'s own start is never materialised.
 */
function startOfNextUnit(
  source: Temporal.PlainDateTime,
  unit: DateTimeUnit,
): Temporal.PlainDateTime {
  if (isValidDateUnit(unit)) {
    return getStartOfNextDateTimeUnit(source, unit);
  }

  return source
    .add(ONE_TIME_UNIT[unit] ?? { nanoseconds: 1 })
    .round({ smallestUnit: unit, roundingMode: "trunc" });
}

/**
 * Count how many `unit` boundaries a date-time interval crosses.
 *
 * - Counts calendar boundaries touched by the half-open interval `[start, end)` — distinct
 *   from `diffDateTime`, which measures exact elapsed duration. An interval from 23:59 to
 *   00:01 is two minutes long but touches 2 day boundaries.
 * - The end boundary is excluded: `"2024-01-01T00:00:00"` to `"2024-01-03T00:00:00"` counts 2 days.
 * - A zero-length interval counts 1 when it sits mid-unit and 0 when it sits exactly on a
 *   unit boundary.
 * - Weeks start on Monday (ISO 8601).
 * - A unit that began before the first representable PlainDateTime
 *   (`-271821-04-19T00:00:00.000000001`) is still counted: whole units are measured from the unit
 *   after `start`'s, never from `start`'s own start.
 * - Accepts singular or plural units (`"day"` and `"days"` behave identically).
 * - Returns `null` on invalid input (unparseable start/end, `start > end`, unsupported unit).
 *
 * @param start ISO PlainDateTime string for the interval start
 * @param end ISO PlainDateTime string for the interval end
 * @param unit unit string — any `DateTimeUnit`
 * @returns number of unit boundaries touched, or null on invalid input
 *
 * @example intervalCountDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "day") // 2
 * @example intervalCountDateTime("2024-01-01T00:00:00", "2024-01-03T00:00:00", "day") // 2
 * @example intervalCountDateTime("2024-01-01T10:30:00", "2024-01-01T12:00:00", "hour") // 2
 * @example intervalCountDateTime("2024-01-01T05:00:00", "2024-01-01T05:00:00", "day") // 1 (zero-length, mid-day)
 * @example intervalCountDateTime("2024-01-01T00:00:00", "2024-01-01T00:00:00", "day") // 0 (zero-length, on the boundary)
 * @example intervalCountDateTime("invalid", "2024-01-02T00:00:00", "day") // null
 */
export function intervalCountDateTime(
  start: string,
  end: string,
  unit: string,
): number | null {
  if (typeof start !== "string" || typeof end !== "string") {
    return null;
  }

  if (!plainDateTime.test(start) || !plainDateTime.test(end)) {
    return null;
  }

  if (!isValidDateTime(start) || !isValidDateTime(end)) {
    return null;
  }

  if (typeof unit !== "string") {
    return null;
  }

  const resolvedUnit = resolveDateTimeUnit(unit);

  if (!isValidDateTimeUnit(resolvedUnit)) {
    return null;
  }

  try {
    const startVal = Temporal.PlainDateTime.from(start);
    const endVal = Temporal.PlainDateTime.from(end);

    if (Temporal.PlainDateTime.compare(startVal, endVal) > 0) {
      return null;
    }

    const startOfEnd = startOfUnitIfRepresentable(endVal, resolvedUnit);

    // `end`'s unit began before the range, so `start` (<= `end`) is in it too, and `end` is not on
    // a boundary: one bucket.
    if (startOfEnd === null) {
      return 1;
    }

    const endBucket = startOfEnd.equals(endVal) ? 0 : 1;

    // `start` is already inside `end`'s unit: no boundary between them.
    if (Temporal.PlainDateTime.compare(startOfEnd, startVal) <= 0) {
      return endBucket;
    }

    // `start`'s unit, plus every whole unit from the next start up to `end`'s unit.
    const spanned =
      1 +
      getUnitSpan(
        startOfNextUnit(startVal, resolvedUnit).until(startOfEnd, {
          largestUnit: resolvedUnit,
        }),
        resolvedUnit,
      );

    return spanned + endBucket;
  } catch {
    return null;
  }
}
