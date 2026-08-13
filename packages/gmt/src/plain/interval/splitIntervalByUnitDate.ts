import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";
import { isValidDate } from "../validate";
import { resolveDurationUnit } from "../../internal";

/**
 * Split a date interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of `{ start, end }` records that tile the interval.
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Returns `[]` on invalid input (unparseable start/end, unsupported unit, non-positive amount,
 *   or a unit that has no effect on `PlainDate`, e.g. `"hours"`).
 *
 * @param start ISO PlainDate string for the interval start
 * @param end ISO PlainDate string for the interval end
 * @param unit duration unit string — `"years" | "months" | "weeks" | "days"` (time units are ignored by PlainDate and return [])
 * @param amount positive number of units per step
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2) // [{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-05" }, { start: "2024-01-05", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-09" }, { start: "2024-01-09", end: "2024-01-10" }]
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-09", "day", 2) // [{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-05" }, { start: "2024-01-05", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-09" }]
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-01", "day", 2) // [{ start: "2024-01-01", end: "2024-01-01" }]
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 0) // []
 * @example splitIntervalByUnitDate("invalid", "2024-01-10", "day", 2) // []
 */
export function splitIntervalByUnitDate(
  start: string,
  end: string,
  unit: string,
  amount: number,
): Array<{ start: string; end: string }> {
  if (typeof start !== "string" || typeof end !== "string") {
    return [];
  }

  if (!plainDate.test(start) || !plainDate.test(end)) {
    return [];
  }

  if (!isValidDate(start) || !isValidDate(end)) {
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
    const startVal = Temporal.PlainDate.from(start);
    const endVal = Temporal.PlainDate.from(end);

    if (Temporal.PlainDate.compare(startVal, endVal) > 0) {
      return [];
    }

    if (Temporal.PlainDate.compare(startVal, endVal) === 0) {
      return [{ start: startVal.toString(), end: endVal.toString() }];
    }

    const result: Array<{ start: string; end: string }> = [];

    for (
      let current = startVal;
      Temporal.PlainDate.compare(current, endVal) < 0;
    ) {
      const next = current.add({ [resolvedUnit]: amount });

      if (Temporal.PlainDate.compare(next, current) === 0) {
        return [];
      }

      const sliceEnd =
        Temporal.PlainDate.compare(next, endVal) > 0 ? endVal : next;

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
