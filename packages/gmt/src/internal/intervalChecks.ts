import { Temporal } from "./temporal";
import { calendarDateOf } from "./calendarDateString";
import { parseCalendarZonedValue } from "./calendarZonedString";
import { plainDateTimeOf, plainTimeOf } from "./inputChecks";
import { utcInstantOf } from "./utcInstant";
import type { IntervalNanoseconds } from "./intervalNanoseconds";

/**
 * The cores of the `isValid*Interval` functions: each reads both endpoints once and returns them,
 * so a caller that goes on to use the endpoints does not parse them again. `null` when either
 * endpoint is invalid or the start is after the end.
 */

/** The two endpoints in order when `first` is not after `last` by `compare`, else `null`. */
function ordered<T>(
  first: T,
  last: T,
  compare: (a: T, b: T) => number,
): readonly [T, T] | null {
  try {
    return compare(first, last) <= 0 ? [first, last] : null;
  } catch {
    return null;
  }
}

/**
 * The check behind `isValidDateInterval`.
 *
 * @param start the candidate start; a value that is not a string is not a date
 * @param end the candidate end
 * @returns both calendar dates, in the computation calendar, when `start` is not after `end`, else `null`
 *
 * @example dateIntervalOf("2024-01-01", "2024-01-31")?.[1].day // 31
 * @example dateIntervalOf("2024-02-01", "2024-01-01") // null
 */
export function dateIntervalOf(
  start: unknown,
  end: unknown,
): readonly [Temporal.PlainDate, Temporal.PlainDate] | null {
  const first = calendarDateOf(start);
  const last = calendarDateOf(end);
  if (first === null || last === null) {
    return null;
  }
  return ordered(first, last, Temporal.PlainDate.compare);
}

/**
 * The check behind `isValidDateTimeInterval`.
 *
 * @param start the candidate start; a value that is not a string is not a date-time
 * @param end the candidate end
 * @returns both date-times when `start` is not after `end`, else `null`
 *
 * @example dateTimeIntervalOf("2024-01-01T08:00", "2024-01-01T17:00")?.[0].hour // 8
 * @example dateTimeIntervalOf("2024-01-01T17:00", "2024-01-01T08:00") // null
 */
export function dateTimeIntervalOf(
  start: unknown,
  end: unknown,
): readonly [Temporal.PlainDateTime, Temporal.PlainDateTime] | null {
  const first = plainDateTimeOf(start);
  const last = plainDateTimeOf(end);
  if (first === null || last === null) {
    return null;
  }
  return ordered(first, last, Temporal.PlainDateTime.compare);
}

/**
 * The check behind `isValidTimeInterval`.
 *
 * @param start the candidate start; a value that is not a string is not a time
 * @param end the candidate end
 * @returns both times when `start` is not after `end`, else `null`
 *
 * @example timeIntervalOf("08:00", "17:00")?.[1].hour // 17
 * @example timeIntervalOf("17:00", "08:00") // null
 */
export function timeIntervalOf(
  start: unknown,
  end: unknown,
): readonly [Temporal.PlainTime, Temporal.PlainTime] | null {
  const first = plainTimeOf(start);
  const last = plainTimeOf(end);
  if (first === null || last === null) {
    return null;
  }
  return ordered(first, last, Temporal.PlainTime.compare);
}

/**
 * The check behind `isValidUtcInterval`.
 *
 * @param start the candidate start; a value that is not a string is not a UTC string
 * @param end the candidate end
 * @returns both instants when `start` is not after `end`, else `null`
 *
 * @example utcIntervalOf("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z")?.[1].epochMilliseconds // 1704153600000
 * @example utcIntervalOf("2024-01-02T00:00:00Z", "2024-01-01T00:00:00Z") // null
 */
export function utcIntervalOf(
  start: unknown,
  end: unknown,
): readonly [Temporal.Instant, Temporal.Instant] | null {
  const first = utcInstantOf(start);
  const last = utcInstantOf(end);
  if (first === null || last === null) {
    return null;
  }
  return ordered(first, last, Temporal.Instant.compare);
}

/**
 * A UTC interval read once into the record the interval cores take: epoch nanoseconds plus the
 * canonical text of each endpoint.
 *
 * @param start the candidate start; a value that is not a string is not a UTC string
 * @param end the candidate end
 * @returns the record when `start` is not after `end`, else `null`
 *
 * @example utcIntervalRecordOf("2024-01-01T00:00:00Z", "2024-01-01T00:00:01Z")?.end // 1704067201000000000n
 * @example utcIntervalRecordOf("2024-01-02T00:00:00Z", "2024-01-01T00:00:00Z") // null
 */
export function utcIntervalRecordOf(
  start: unknown,
  end: unknown,
): IntervalNanoseconds | null {
  const pair = utcIntervalOf(start, end);
  if (pair === null) {
    return null;
  }
  const [first, last] = pair;
  return {
    start: first.epochNanoseconds,
    end: last.epochNanoseconds,
    startText: first.toString(),
    endText: last.toString(),
  };
}

/**
 * The check behind `isValidCalendarZonedInterval`.
 *
 * @param start the candidate start; a value that is not a string is not a zoned date-time
 * @param end the candidate end
 * @returns both zoned date-times, in the computation calendar, when the start instant is not after the end instant, else `null`
 *
 * @example calendarZonedIntervalOf("2024-03-10T08:00:00+00:00[UTC]", "2024-03-10T09:00:00+00:00[UTC]")?.[0].hour // 8
 * @example calendarZonedIntervalOf("2024-03-10T09:00:00+00:00[UTC]", "2024-03-10T08:00:00+00:00[UTC]") // null
 */
export function calendarZonedIntervalOf(
  start: unknown,
  end: unknown,
): readonly [Temporal.ZonedDateTime, Temporal.ZonedDateTime] | null {
  if (typeof start !== "string" || typeof end !== "string") {
    return null;
  }
  try {
    const first = parseCalendarZonedValue(start);
    const last = parseCalendarZonedValue(end);
    return Temporal.Instant.compare(first.toInstant(), last.toInstant()) <= 0
      ? [first, last]
      : null;
  } catch {
    return null;
  }
}
