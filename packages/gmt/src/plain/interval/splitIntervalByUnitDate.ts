import { Temporal } from "@js-temporal/polyfill";
import {
  formatDateInCalendar,
  parseCalendarDatePairForArithmetic,
  resolveDurationUnit,
} from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Split a date interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of `{ start, end }` records that tile the interval.
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Returns `[]` on invalid input (unparseable start/end, unsupported unit, non-positive amount,
 *   or a unit that has no effect on `PlainDate`, e.g. `"hours"`).
 * - Accepts GMT calendar-annotated PlainDate strings — E5 (issue #78). When `start` and `end`
 *   carry the *same* calendar tag, stepping (and each slice's boundaries) happens in that
 *   calendar — a Hebrew leap year splits into 13 month-slices, not 12 (E5 decision of record
 *   D5); otherwise (or if either is bare ISO) it falls back to Gregorian. Each boundary's tag is
 *   re-derived from the actual stepped date, never copied — a month-by-month step can cross a
 *   leap-month or era boundary mid-split.
 *
 * @param start ISO PlainDate string for the interval start, optionally calendar-annotated
 * @param end ISO PlainDate string for the interval end, optionally calendar-annotated
 * @param unit duration unit string — `"years" | "months" | "weeks" | "days"` (time units are ignored by PlainDate and return [])
 * @param amount positive number of units per step
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2) // [{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-05" }, { start: "2024-01-05", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-09" }, { start: "2024-01-09", end: "2024-01-10" }]
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-09", "day", 2) // [{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-05" }, { start: "2024-01-05", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-09" }]
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-01", "day", 2) // [{ start: "2024-01-01", end: "2024-01-01" }]
 * @example splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 0) // []
 * @example splitIntervalByUnitDate("invalid", "2024-01-10", "day", 2) // []
 * @example splitIntervalByUnitDate("5784-01-01[u-ca=hebrew]", "5785-01-01[u-ca=hebrew]", "month", 1) // 13 slices, tiling the Hebrew leap year (including Adar I)
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

  if (!isValidCalendarDate(start) || !isValidCalendarDate(end)) {
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
    const {
      calendar,
      a: startVal,
      b: endVal,
    } = parseCalendarDatePairForArithmetic(start, end);

    if (Temporal.PlainDate.compare(startVal, endVal) > 0) {
      return [];
    }

    if (Temporal.PlainDate.compare(startVal, endVal) === 0) {
      return [
        {
          start: formatDateInCalendar(startVal, calendar),
          end: formatDateInCalendar(endVal, calendar),
        },
      ];
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
        start: formatDateInCalendar(current, calendar),
        end: formatDateInCalendar(sliceEnd, calendar),
      });

      current = next;
    }

    return result;
  } catch {
    return [];
  }
}
