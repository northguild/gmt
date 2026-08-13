import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../regex";
import { isValidDateTime } from "../validate";
import { resolveDurationUnit } from "../../internal";

/**
 * Split a date-time interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of `{ start, end }` records that tile the interval.
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Returns `[]` on invalid input (unparseable start/end, unsupported unit, non-positive amount).
 *
 * @param start ISO PlainDateTime string for the interval start
 * @param end ISO PlainDateTime string for the interval end
 * @param unit duration unit string — any `DateTimeDurationUnit`
 * @param amount positive number of units per step
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitDateTime("2024-01-01T12:00:00", "2024-01-01T14:00:00", "hour", 1) // [{ start: "2024-01-01T12:00:00", end: "2024-01-01T13:00:00" }, { start: "2024-01-01T13:00:00", end: "2024-01-01T14:00:00" }]
 * @example splitIntervalByUnitDateTime("2024-01-01T12:00:00", "2024-01-01T14:30:00", "hour", 1) // [{ start: "2024-01-01T12:00:00", end: "2024-01-01T13:00:00" }, { start: "2024-01-01T13:00:00", end: "2024-01-01T14:00:00" }, { start: "2024-01-01T14:00:00", end: "2024-01-01T14:30:00" }]
 * @example splitIntervalByUnitDateTime("2024-01-01T12:00:00", "2024-01-01T12:00:00", "hour", 1) // [{ start: "2024-01-01T12:00:00", end: "2024-01-01T12:00:00" }]
 * @example splitIntervalByUnitDateTime("2024-01-01T12:00:00", "2024-01-01T14:00:00", "hour", 0) // []
 * @example splitIntervalByUnitDateTime("invalid", "2024-01-01T14:00:00", "hour", 1) // []
 */
export function splitIntervalByUnitDateTime(
  start: string,
  end: string,
  unit: string,
  amount: number,
): Array<{ start: string; end: string }> {
  if (typeof start !== "string" || typeof end !== "string") {
    return [];
  }

  if (!plainDateTime.test(start) || !plainDateTime.test(end)) {
    return [];
  }

  if (!isValidDateTime(start) || !isValidDateTime(end)) {
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
    const startVal = Temporal.PlainDateTime.from(start);
    const endVal = Temporal.PlainDateTime.from(end);

    if (Temporal.PlainDateTime.compare(startVal, endVal) > 0) {
      return [];
    }

    if (Temporal.PlainDateTime.compare(startVal, endVal) === 0) {
      return [{ start: startVal.toString(), end: endVal.toString() }];
    }

    const result: Array<{ start: string; end: string }> = [];

    for (
      let current = startVal;
      Temporal.PlainDateTime.compare(current, endVal) < 0;
    ) {
      const next = current.add({ [resolvedUnit]: amount });

      if (Temporal.PlainDateTime.compare(next, current) === 0) {
        return [];
      }

      const sliceEnd =
        Temporal.PlainDateTime.compare(next, endVal) > 0 ? endVal : next;

      result.push({
        start: current.toString(),
        end: sliceEnd.toString(),
      });

      current = next;
    }

    return result;
  } catch {
    return [];
  }
}
