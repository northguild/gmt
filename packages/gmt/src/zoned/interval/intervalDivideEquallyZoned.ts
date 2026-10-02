// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllZonedValues,
  formatZonedInCalendar,
  parseCalendarZonedValue,
} from "../../internal";
import { isValidCalendarZonedInterval } from "./validate";
import { divisionBoundary } from "../../internal/divisionBoundary";
import { exceedsPieceLimit, resolveMaxPieces } from "../../internal/maxPieces";

/**
 * Split a zoned interval into `n` equal-length sub-intervals.
 *
 * - Returns an array of `n` half-open `[start, end)` records that tile the original interval: each
 *   record's `end` is the next record's `start` and belongs only to that next record, so the
 *   pieces share no instant and together cover `[start, end)` exactly once.
 * - Each boundary is `start + round((end - start) · i / n)` in integer epoch nanoseconds (real
 *   elapsed time, exact at any span length), so a spring-forward day split in half lands exactly
 *   on the DST transition's real midpoint rather than the local-clock midpoint.
 * - When `n` is larger than the number of nanoseconds in the interval, some pieces are empty (their
 *   `start` equals their `end`): the result always has exactly `n` pieces.
 * - `n === 1` returns the original interval unchanged, as a single-element array.
 * - A zero-length interval (`start === end`) returns `n` identical zero-length sub-intervals, each
 *   an empty `[start, start)` that holds no instant.
 * - `start` and `end` may name different time zones. The first `start` and every inner boundary
 *   are written in `start`'s zone; the last `end` is the `end` argument, in its own zone.
 * - Returns `[]` when `n` is not a positive integer, or on invalid input (unparseable
 *   start/end, `start > end`, leap-second strings).
 * - Accepts RFC 9557 calendar-annotated zoned strings (as produced by `convertZonedToCalendar`) as
 *   well as bare ISO ones — E7 (issue #152) — but **rejects a mismatched pair**: `start` and `end`
 *   must name the same calendar system (E7's D4-zoned), since the synthesized boundaries are
 *   values the caller reads back as datetimes and an array of differently-tagged records would be
 *   unreadable as a set. A mismatch returns `[]`.
 * - Output boundaries are re-derived in the resolved calendar via `formatZonedInCalendar`, never
 *   copied from an input string (E7's D7-zoned).
 * - An `n` over `options.maxPieces` returns `[]` before any piece is built.
 *
 * @param start ISO 8601 zoned datetime string for the interval start
 * @param end ISO 8601 zoned datetime string for the interval end
 * @param n number of equal sub-intervals to produce (positive integer)
 * @param options optional limit on the size of the output
 * @returns array of `n` `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalDivideEquallyZoned("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-11T12:00:00-04:00[America/New_York]", 2) // [{ start: "2024-03-09T12:00:00-05:00[America/New_York]", end: "2024-03-10T12:30:00-04:00[America/New_York]" }, { start: "2024-03-10T12:30:00-04:00[America/New_York]", end: "2024-03-11T12:00:00-04:00[America/New_York]" }] (47 real hours split in half)
 * @example intervalDivideEquallyZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-04T00:00:00+00:00[UTC]", 1) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-04T00:00:00+00:00[UTC]" }]
 * @example intervalDivideEquallyZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-04T00:00:00+00:00[UTC]", 0) // []
 * @example intervalDivideEquallyZoned("invalid", "2024-01-04T00:00:00+00:00[UTC]", 3) // []
 * @example intervalDivideEquallyZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-04T00:00:00+00:00[UTC]", 3, { maxPieces: 2 }) // [] (3 pieces exceed the limit)
 * @example intervalDivideEquallyZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-04T00:00:00+00:00[UTC]", 3, { maxPieces: 3 }) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-02T00:00:00+00:00[UTC]" }, { start: "2024-01-02T00:00:00+00:00[UTC]", end: "2024-01-03T00:00:00+00:00[UTC]" }, { start: "2024-01-03T00:00:00+00:00[UTC]", end: "2024-01-04T00:00:00+00:00[UTC]" }]
 */
export function intervalDivideEquallyZoned(
  start: string,
  end: string,
  n: number,
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
    if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
      return [];
    }

    const maxPieces = resolveMaxPieces(options);

    if (maxPieces === null || exceedsPieceLimit(n, maxPieces)) {
      return [];
    }

    if (!isValidCalendarZonedInterval(start, end)) {
      return [];
    }

    // D4-zoned reject gate: both endpoints must agree on a calendar, or there is no calendar to
    // express the synthesized boundaries in.
    const calendar = calendarOfAllZonedValues([start, end]);
    if (!calendar) {
      return [];
    }

    try {
      const startVal = parseCalendarZonedValue(start);
      const endVal = parseCalendarZonedValue(end);

      // Safe: `.equals()` here is `Temporal.Instant.prototype.equals`, and `Instant` carries no
      // calendar field at all — verified calendar-blind. E7 re-audited this site rather than
      // inheriting E5's "structurally unreachable" verdict, which depended on mixed calendars never
      // reaching `zoned/` at all.
      if (startVal.toInstant().equals(endVal.toInstant())) {
        return Array.from({ length: n }, () => ({
          start: formatZonedInCalendar(startVal, calendar),
          end: formatZonedInCalendar(endVal, calendar),
        }));
      }

      const startNs = startVal.epochNanoseconds;
      const totalNs = endVal.epochNanoseconds - startNs;

      const boundaries: Array<typeof startVal> = [startVal];
      for (let i = 1; i < n; i++) {
        boundaries.push(
          new Temporal.ZonedDateTime(
            startNs + divisionBoundary(totalNs, i, n),
            startVal.timeZoneId,
            startVal.calendarId,
          ),
        );
      }
      boundaries.push(endVal);

      const result: Array<{ start: string; end: string }> = [];
      for (let i = 0; i < boundaries.length - 1; i++) {
        result.push({
          start: formatZonedInCalendar(boundaries[i], calendar),
          end: formatZonedInCalendar(boundaries[i + 1], calendar),
        });
      }

      return result;
    } catch {
      return [];
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
