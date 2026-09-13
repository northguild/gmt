import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { utcDateTime } from "../../regex/utc-date-time";
import { isValidUtc } from "../validate/isValidUtc";
import { resolveDurationUnit, tileByUnit } from "../../internal";

/**
 * Split a UTC interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of `{ start, end }` records that tile the interval.
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
 * - Calendar-unit boundaries (years, months, weeks, days) are computed from `start`
 *   (`start + k × amount`, as Temporal and Luxon's `Interval.splitBy` do), so month-end starts
 *   don't drift: a monthly split from January 31 lands on February 29, March 31, April 30.
 * - Exact-unit boundaries (hours and smaller) step from the previous boundary. Exact units never
 *   clamp, and stepping keeps nanosecond precision where `k × amount` would pass
 *   `Number.MAX_SAFE_INTEGER`.
 * - A step that resolves to the same instant as the previous boundary is skipped, so no empty
 *   slice is produced. A step that goes backwards returns `[]`.
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Returns `[]` on invalid input (unparseable start/end, unsupported unit, non-positive amount,
 *   leap-second strings).
 *
 * @param start ISO UTC datetime string for the interval start
 * @param end ISO UTC datetime string for the interval end
 * @param unit duration unit string — any `DateTimeDurationUnit`
 * @param amount positive number of units per step
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitUtc("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "hour", 6) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T06:00:00Z" }, { start: "2024-01-01T06:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" }, { start: "2024-01-01T18:00:00Z", end: "2024-01-02T00:00:00Z" }]
 * @example splitIntervalByUnitUtc("2024-01-01T00:00:00Z", "2024-01-01T01:30:00Z", "hour", 1) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T01:00:00Z" }, { start: "2024-01-01T01:00:00Z", end: "2024-01-01T01:30:00Z" }]
 * @example splitIntervalByUnitUtc("2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", "hour", 1) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" }]
 * @example splitIntervalByUnitUtc("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "hour", 0) // []
 * @example splitIntervalByUnitUtc("invalid", "2024-01-02T00:00:00Z", "hour", 1) // []
 */
export function splitIntervalByUnitUtc(
  start: string,
  end: string,
  unit: string,
  amount: number,
): Array<{ start: string; end: string }> {
  if (typeof start !== "string" || typeof end !== "string") {
    return [];
  }

  if (!utcDateTime.test(start) || !utcDateTime.test(end)) {
    return [];
  }

  if (isLeapSecond(start) || isLeapSecond(end)) {
    return [];
  }

  if (!isValidUtc(start) || !isValidUtc(end)) {
    return [];
  }

  if (typeof unit !== "string") {
    return [];
  }

  const resolvedUnit = resolveDurationUnit(unit);

  if (!resolvedUnit) {
    return [];
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return [];
  }

  try {
    const startInstant = Temporal.Instant.from(start);
    const endInstant = Temporal.Instant.from(end);

    if (Temporal.Instant.compare(startInstant, endInstant) > 0) {
      return [];
    }

    if (Temporal.Instant.compare(startInstant, endInstant) === 0) {
      return [{ start: startInstant.toString(), end: endInstant.toString() }];
    }

    const slices = tileByUnit(
      startInstant.toZonedDateTimeISO("UTC"),
      endInstant.toZonedDateTimeISO("UTC"),
      Temporal.ZonedDateTime.compare,
      resolvedUnit,
      amount,
    );

    return (slices ?? []).map(([sliceStart, sliceEnd]) => ({
      start: sliceStart.toInstant().toString(),
      end: sliceEnd.toInstant().toString(),
    }));
  } catch {
    return [];
  }
}
