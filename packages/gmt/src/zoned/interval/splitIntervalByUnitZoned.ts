import { Temporal } from "@js-temporal/polyfill";
import {
  formatZonedInCalendar,
  parseCalendarZonedPairForArithmetic,
  resolveDurationUnit,
} from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate/isValidCalendarZonedDateTime";

/**
 * Split a zoned interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of `{ start, end }` records that tile the interval.
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Accepts GMT calendar-annotated zoned strings (as produced by `convertZonedToCalendar`) as
 *   well as bare ISO ones — E7 (issue #152). Stepping by a calendar unit ("1 month") resolves
 *   against the endpoints' shared calendar when both tags match, and falls back to Gregorian/ISO
 *   when they mismatch or either endpoint is bare (E7's D5-zoned). Sub-interval boundaries are
 *   re-derived in the resolved calendar via `formatZonedInCalendar`, never copied from an input
 *   string (E7's D7-zoned).
 * - Returns `[]` on invalid input (unparseable start/end, unsupported unit, non-positive amount,
 *   leap-second strings).
 *
 * @param start ISO 8601 zoned datetime string for the interval start
 * @param end ISO 8601 zoned datetime string for the interval end
 * @param unit duration unit string — any `DateTimeDurationUnit`
 * @param amount positive number of units per step
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-02T00:00:00+00:00[UTC]", "hour", 6) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-01T06:00:00+00:00[UTC]" }, { start: "2024-01-01T06:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }, { start: "2024-01-01T12:00:00+00:00[UTC]", end: "2024-01-01T18:00:00+00:00[UTC]" }, { start: "2024-01-01T18:00:00+00:00[UTC]", end: "2024-01-02T00:00:00+00:00[UTC]" }]
 * @example splitIntervalByUnitZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-01T01:30:00+00:00[UTC]", "hour", 1) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-01T01:00:00+00:00[UTC]" }, { start: "2024-01-01T01:00:00+00:00[UTC]", end: "2024-01-01T01:30:00+00:00[UTC]" }]
 * @example splitIntervalByUnitZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-01T00:00:00+00:00[UTC]", "hour", 1) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-01T00:00:00+00:00[UTC]" }]
 * @example splitIntervalByUnitZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-02T00:00:00+00:00[UTC]", "hour", 0) // []
 * @example splitIntervalByUnitZoned("invalid", "2024-01-02T00:00:00+00:00[UTC]", "hour", 1) // []
 */
export function splitIntervalByUnitZoned(
  start: string,
  end: string,
  unit: string,
  amount: number,
): Array<{ start: string; end: string }> {
  if (
    !isValidCalendarZonedDateTime(start) ||
    !isValidCalendarZonedDateTime(end)
  ) {
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
    } = parseCalendarZonedPairForArithmetic(start, end);

    if (Temporal.ZonedDateTime.compare(startVal, endVal) > 0) {
      return [];
    }

    if (Temporal.ZonedDateTime.compare(startVal, endVal) === 0) {
      return [
        {
          start: formatZonedInCalendar(startVal, calendar),
          end: formatZonedInCalendar(endVal, calendar),
        },
      ];
    }

    const result: Array<{ start: string; end: string }> = [];

    for (
      let current = startVal;
      Temporal.ZonedDateTime.compare(current, endVal) < 0;
    ) {
      const next = current.add({ [resolvedUnit]: amount });

      if (Temporal.ZonedDateTime.compare(next, current) === 0) {
        return [];
      }

      const sliceEnd =
        Temporal.ZonedDateTime.compare(next, endVal) > 0 ? endVal : next;

      result.push({
        start: formatZonedInCalendar(current, calendar),
        end: formatZonedInCalendar(sliceEnd, calendar),
      });

      current = next;
    }

    return result;
  } catch {
    return [];
  }
}
