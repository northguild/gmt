import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllZonedValues,
  formatZonedInCalendar,
  parseCalendarZonedValue,
} from "../../internal";
import { isValidCalendarZonedDateTime } from "../validate/isValidCalendarZonedDateTime";
import { isValidCalendarZonedInterval } from "./validate";

/**
 * Split a zoned interval at arbitrary `points`, producing consecutive sub-intervals.
 *
 * - `points` need not be sorted — they are sorted internally (by instant) before splitting.
 * - Comparison and boundary placement use the instant each point represents, so points may
 *   carry a different time zone than `start`/`end`.
 * - Points outside `[start, end]` are dropped; they cannot introduce a boundary that isn't
 *   inside the interval.
 * - Points on the same instant as `start` or `end` are dropped too — they would only produce a
 *   zero-length sub-interval at the edge.
 * - Duplicate points (same instant) collapse to a single boundary.
 * - Returns `[{ start, end }]` (the whole interval, unsplit) when no valid in-range point remains.
 * - Returns `[]` when `points` is not an array, when any element is not a valid ISO
 *   ZonedDateTime string, or on invalid input (unparseable start/end, `start > end`,
 *   leap-second strings).
 * - Accepts GMT calendar-annotated zoned strings (as produced by `convertZonedToCalendar`) as
 *   well as bare ISO ones — E7 (issue #152) — but **rejects a mismatched set**: `start`, `end`
 *   and every element of `points` must name the same calendar system (E7's D4-zoned), since the
 *   returned sub-intervals are values the caller reads back as datetimes and an array of
 *   differently-tagged records would be unreadable as a set. A mismatch returns `[]`.
 * - Output boundaries are re-derived in the resolved calendar via `formatZonedInCalendar`, never
 *   copied from an input string (E7's D7-zoned).
 *
 * @param start ISO 8601 zoned datetime string for the interval start
 * @param end ISO 8601 zoned datetime string for the interval end
 * @param points array of ISO 8601 zoned datetime strings to split at
 * @returns array of `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalSplitAtZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-10T00:00:00+00:00[UTC]", ["2024-01-05T00:00:00+00:00[UTC]"]) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-05T00:00:00+00:00[UTC]" }, { start: "2024-01-05T00:00:00+00:00[UTC]", end: "2024-01-10T00:00:00+00:00[UTC]" }]
 * @example intervalSplitAtZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-10T00:00:00+00:00[UTC]", []) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-10T00:00:00+00:00[UTC]" }]
 * @example intervalSplitAtZoned("invalid", "2024-01-10T00:00:00+00:00[UTC]", ["2024-01-05T00:00:00+00:00[UTC]"]) // []
 */
export function intervalSplitAtZoned(
  start: string,
  end: string,
  points: string[],
): Array<{ start: string; end: string }> {
  if (!Array.isArray(points)) {
    return [];
  }

  if (!isValidCalendarZonedInterval(start, end)) {
    return [];
  }

  if (!points.every((point) => isValidCalendarZonedDateTime(point))) {
    return [];
  }

  // D4-zoned reject gate: the interval's endpoints AND every split point must agree on a
  // calendar, or there is no calendar to express the returned sub-intervals in.
  const calendar = calendarOfAllZonedValues([start, end, ...points]);
  if (!calendar) {
    return [];
  }

  try {
    const startVal = parseCalendarZonedValue(start);
    const endVal = parseCalendarZonedValue(end);
    const startInstant = startVal.toInstant();
    const endInstant = endVal.toInstant();

    const parsedPoints = points.map((point) => parseCalendarZonedValue(point));

    const inRangePoints = parsedPoints.filter((point) => {
      const instant = point.toInstant();
      return (
        Temporal.Instant.compare(instant, startInstant) > 0 &&
        Temporal.Instant.compare(instant, endInstant) < 0
      );
    });

    inRangePoints.sort((a, b) =>
      Temporal.Instant.compare(a.toInstant(), b.toInstant()),
    );

    // Safe: `.equals()` here is `Temporal.Instant.prototype.equals`, and `Instant` carries no
    // calendar field at all — verified calendar-blind. E7 re-audited this site rather than
    // inheriting E5's "structurally unreachable" verdict, which depended on mixed calendars never
    // reaching `zoned/` at all.
    const uniquePoints = inRangePoints.filter(
      (point, index) =>
        index === 0 ||
        !point.toInstant().equals(inRangePoints[index - 1].toInstant()),
    );

    const boundaries = [startVal, ...uniquePoints, endVal];

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
}
