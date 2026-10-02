// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import {
  addToZoned,
  formatZonedInCalendar,
  parseCalendarZonedPairForArithmetic,
  resolveDurationUnit,
  tileByUnit,
} from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import { isValidCalendarZonedDateTime } from "../validate/isValidCalendarZonedDateTime";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";
import { minSlicesForSpan } from "../../internal/splitStep";

/**
 * Split a zoned interval into sub-intervals of `amount × unit`.
 *
 * - Returns an array of half-open `[start, end)` records that tile the interval: each record's
 *   `end` is the next record's `start` and belongs only to that next record, so the pieces share
 *   no instant and together cover `[start, end)` exactly once.
 * - The final sub-interval is trimmed so its `end` never exceeds the original `end`.
 * - Calendar-unit boundaries (years, months, weeks, days) are computed from `start`
 *   (`start + k × amount`), so month-end starts don't drift: a monthly split from January 31
 *   lands on February 29, March 31, April 30. Temporal's `add` constrains a day the month lacks
 *   to the month's last day, and stepping from that boundary would keep the shortened day
 *   (February 29, then March 29).
 * - Comparison: Luxon's `Interval.splitBy` computes each boundary from the start the same way.
 * - Exact-unit boundaries (hours and smaller) step from the previous boundary. Exact units never
 *   clamp, and stepping keeps nanosecond precision where `k × amount` would pass
 *   `Number.MAX_SAFE_INTEGER`.
 * - A calendar step that resolves to the same instant as the previous boundary (a deleted local
 *   day, such as 30 December 2011 in `Pacific/Apia`) is skipped, so no empty slice is produced.
 *   A step that goes backwards returns `[]`.
 * - `start` and `end` may name different time zones. Steps are taken from `start`, so the first
 *   `start` and every inner boundary are written in `start`'s zone; the last `end` is the `end`
 *   argument, in its own zone.
 * - Returns `[{ start, end }]` when `start === end` (zero-length interval).
 * - Accepts RFC 9557 calendar-annotated zoned strings (as produced by `convertZonedToCalendar`) as
 *   well as bare ISO ones — E7 (issue #152). Stepping by a calendar unit ("1 month") resolves
 *   against the endpoints' shared calendar; when they name different calendars (a bare string
 *   names `iso8601`) the result is `[]`, as Temporal's `until` throws when `CalendarEquals` is
 *   false (before 1.16.0 it stepped in ISO). Sub-interval boundaries are
 *   re-derived in the resolved calendar via `formatZonedInCalendar`, never copied from an input
 *   string (E7's D7-zoned).
 * - Returns `[]` on invalid input (unparseable start/end, unsupported unit, non-positive amount,
 *   leap-second strings).
 * - A split into more than `options.maxPieces` slices returns `[]`, decided from the span before
 *   stepping where it can be, and otherwise as soon as slice `maxPieces + 1` is due.
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, the `[u-ca=<id>]`
 *   annotation after the zone, canonical calendar ids); see `isValidCalendarZonedDateTime`.
 *
 * @param start ISO 8601 zoned datetime string for the interval start
 * @param end ISO 8601 zoned datetime string for the interval end
 * @param unit duration unit string — any `DateTimeDurationUnit`
 * @param amount positive number of units per step
 * @param options optional limit on the size of the output
 * @returns array of `{ start, end }` records, or [] on invalid input
 *
 * @example splitIntervalByUnitZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-02T00:00:00+00:00[UTC]", "hour", 6) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-01T06:00:00+00:00[UTC]" }, { start: "2024-01-01T06:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }, { start: "2024-01-01T12:00:00+00:00[UTC]", end: "2024-01-01T18:00:00+00:00[UTC]" }, { start: "2024-01-01T18:00:00+00:00[UTC]", end: "2024-01-02T00:00:00+00:00[UTC]" }]
 * @example splitIntervalByUnitZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-01T01:30:00+00:00[UTC]", "hour", 1) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-01T01:00:00+00:00[UTC]" }, { start: "2024-01-01T01:00:00+00:00[UTC]", end: "2024-01-01T01:30:00+00:00[UTC]" }]
 * @example splitIntervalByUnitZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-01T00:00:00+00:00[UTC]", "hour", 1) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-01T00:00:00+00:00[UTC]" }]
 * @example splitIntervalByUnitZoned("2011-12-29T12:00:00-10:00[Pacific/Apia]", "2012-01-01T12:00:00+14:00[Pacific/Apia]", "day", 1) // [{ start: "2011-12-29T12:00:00-10:00[Pacific/Apia]", end: "2011-12-31T12:00:00+14:00[Pacific/Apia]" }, { start: "2011-12-31T12:00:00+14:00[Pacific/Apia]", end: "2012-01-01T12:00:00+14:00[Pacific/Apia]" }]
 * @example splitIntervalByUnitZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-02T00:00:00+00:00[UTC]", "hour", 0) // []
 * @example splitIntervalByUnitZoned("invalid", "2024-01-02T00:00:00+00:00[UTC]", "hour", 1) // []
 * @example splitIntervalByUnitZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-01T01:30:00+00:00[UTC]", "hour", 1, { maxPieces: 1 }) // [] (2 slices exceed the limit)
 * @example splitIntervalByUnitZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-01T01:30:00+00:00[UTC]", "hour", 1, { maxPieces: 2 }) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-01T01:00:00+00:00[UTC]" }, { start: "2024-01-01T01:00:00+00:00[UTC]", end: "2024-01-01T01:30:00+00:00[UTC]" }]
 */
export function splitIntervalByUnitZoned(
  start: string,
  end: string,
  unit: string,
  amount: number,
  options?: {
    /**
     * The most sub-intervals the result may hold. A result that would be larger, or longer than the
     * longest possible array (2^32 - 1), returns `[]` instead. A value that is not a positive safe
     * integer also returns `[]`.
     *
     * @defaultValue `1_000_000`
     */
    maxPieces?: number;
  },
): Array<{
  /**
   * The instant the interval begins at, as a zoned ISO 8601 string with offset and bracketed time
   * zone. It keeps a calendar annotation such as `[u-ca=hebrew]` when the inputs carry one.
   */
  start: string;
  /**
   * The first instant after the interval, in the same format as `start`. It is exclusive: the
   * interval holds everything from `start` up to but not including this value. It can equal
   * `start`, which makes the interval empty.
   */
  end: string;
}> {
  try {
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

    // An unknown unit is invalid whatever the span, a zero-length one included.
    if (!isValidDateTimeDurationUnit(resolvedUnit)) {
      return [];
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return [];
    }

    const maxPieces = resolveMaxPieces(options);

    if (maxPieces === null) {
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
      const spanNs = Number(
        endVal.epochNanoseconds - startVal.epochNanoseconds,
      );

      if (
        exceedsPieceLimit(
          minSlicesForSpan(spanNs, resolvedUnit, amount, true),
          maxPieces,
        )
      ) {
        return [];
      }

      // `addToZoned` runs calendar units through the Temporal compat layer (CORE-6).
      const slices = tileByUnit(
        startVal,
        endVal,
        Temporal.ZonedDateTime.compare,
        resolvedUnit,
        amount,
        maxPieces,
        (value, duration) => addToZoned(value, duration),
      );

      return (slices ?? []).map(([sliceStart, sliceEnd]) => ({
        start: formatZonedInCalendar(sliceStart, calendar),
        end: formatZonedInCalendar(sliceEnd, calendar),
      }));
    } catch {
      return [];
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
