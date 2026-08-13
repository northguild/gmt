import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { utcDateTime } from "../../regex/utc-date-time";
import { isValidUtc } from "../validate/isValidUtc";
import { resolveDurationUnit } from "../../internal";

/**
 * Split a UTC interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of `{ start, end }` records that tile the interval.
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
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

    const result: Array<{ start: string; end: string }> = [];

    for (
      let currentInstant = startInstant;
      Temporal.Instant.compare(currentInstant, endInstant) < 0;
    ) {
      const zoned = currentInstant.toZonedDateTimeISO("UTC");
      const next = zoned.add({ [resolvedUnit]: amount }).toInstant();

      if (Temporal.Instant.compare(next, currentInstant) === 0) {
        return [];
      }

      const sliceEnd =
        Temporal.Instant.compare(next, endInstant) > 0 ? endInstant : next;

      result.push({
        start: currentInstant.toString(),
        end: sliceEnd.toString(),
      });

      currentInstant = next;
    }

    return result;
  } catch {
    return [];
  }
}
