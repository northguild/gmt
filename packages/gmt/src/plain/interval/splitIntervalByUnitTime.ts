import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";
import { isValidTime } from "../validate";
import { resolveDurationUnit } from "../../internal";

/**
 * Split a time interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of `{ start, end }` records that tile the interval.
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Returns `[]` on invalid input (unparseable start/end, unsupported unit, non-positive amount,
 *   or a unit that has no effect on `PlainTime`, e.g. `"days"`).
 *
 * @param start ISO PlainTime string for the interval start
 * @param end ISO PlainTime string for the interval end
 * @param unit duration unit string — `"hours" | "minutes" | "seconds" | "milliseconds" | "microseconds" | "nanoseconds"` (calendar units are ignored by PlainTime and return [])
 * @param amount positive number of units per step
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitTime("12:00:00", "14:00:00", "hour", 1) // [{ start: "12:00:00", end: "13:00:00" }, { start: "13:00:00", end: "14:00:00" }]
 * @example splitIntervalByUnitTime("12:00:00", "14:30:00", "hour", 1) // [{ start: "12:00:00", end: "13:00:00" }, { start: "13:00:00", end: "14:00:00" }, { start: "14:00:00", end: "14:30:00" }]
 * @example splitIntervalByUnitTime("12:00:00", "12:00:00", "hour", 1) // [{ start: "12:00:00", end: "12:00:00" }]
 * @example splitIntervalByUnitTime("12:00:00", "14:00:00", "hour", 0) // []
 * @example splitIntervalByUnitTime("invalid", "14:00:00", "hour", 1) // []
 */
export function splitIntervalByUnitTime(
  start: string,
  end: string,
  unit: string,
  amount: number,
): Array<{ start: string; end: string }> {
  if (typeof start !== "string" || typeof end !== "string") {
    return [];
  }

  if (!plainTime.test(start) || !plainTime.test(end)) {
    return [];
  }

  if (!isValidTime(start) || !isValidTime(end)) {
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
    const startVal = Temporal.PlainTime.from(start);
    const endVal = Temporal.PlainTime.from(end);

    if (Temporal.PlainTime.compare(startVal, endVal) > 0) {
      return [];
    }

    if (Temporal.PlainTime.compare(startVal, endVal) === 0) {
      return [{ start: startVal.toString(), end: endVal.toString() }];
    }

    const result: Array<{ start: string; end: string }> = [];

    for (
      let current = startVal;
      Temporal.PlainTime.compare(current, endVal) < 0;
    ) {
      const next = current.add({ [resolvedUnit]: amount });

      if (Temporal.PlainTime.compare(next, current) === 0) {
        return [];
      }

      const sliceEnd =
        Temporal.PlainTime.compare(next, endVal) > 0 ? endVal : next;

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
