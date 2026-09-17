// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import {
  getUnitSpan,
  parseCalendarDatePairForArithmetic,
  resolveDateTimeUnit,
} from "../../internal";
import {
  getStartOfDateUnit,
  getStartOfNextDateUnit,
} from "../../internal/dateUnitHelpers";
import {
  type CalendarDateUnit,
  calendarDateUntil,
} from "../../internal/temporalCompat";
import { isValidCalendarDate, isValidDateUnit } from "../validate";

/** The start of the date `unit` holding `source`, or null when it lies before the representable range. */
function startOfUnitIfRepresentable(
  source: Temporal.PlainDate,
  unit: string,
): Temporal.PlainDate | null {
  try {
    return getStartOfDateUnit(source, unit);
  } catch {
    return null;
  }
}

/**
 * Count how many `unit` boundaries a date interval crosses.
 *
 * - Counts calendar boundaries touched by the half-open interval `[start, end)` — distinct
 *   from `diffDate`, which measures exact elapsed duration.
 * - `"2024-01-01"` to `"2024-01-03"` counted in days is 2: the end boundary is excluded.
 * - A zero-length interval (`start === end`) returns `0`: the empty `[start, start)` holds no instant,
 *   so it touches no unit (before 1.16.0 it counted 1 when mid-unit).
 * - Weeks start on Monday (ISO 8601).
 * - A unit that began before the first representable date (`-271821-04-19`) is still counted:
 *   whole units are measured from the unit after `start`'s, never from `start`'s own start.
 * - Accepts singular or plural units (`"day"` and `"days"` behave identically).
 * - Returns `null` on invalid input (unparseable start/end, `start > end`, unsupported unit,
 *   or a unit that has no effect on `PlainDate`, e.g. `"hours"`).
 * - Accepts RFC 9557 calendar-annotated PlainDate strings — E5 (issue #78). When `start` and `end`
 *   carry the *same* calendar tag, boundaries are counted in that calendar (a Hebrew leap year
 *   crosses 13 month boundaries, not 12). When they name different calendars (a bare ISO string
 *   names `iso8601`) the result is `null`, as Temporal's `until` throws when `CalendarEquals` is
 *   false (before 1.16.0 it counted in ISO).
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, `[u-ca=<id>]`, canonical
 *   calendar ids); see `isValidCalendarDate`.
 *
 * @param start ISO PlainDate string for the interval start, optionally calendar-annotated
 * @param end ISO PlainDate string for the interval end, optionally calendar-annotated
 * @param unit unit string — `"year" | "month" | "week" | "day"` (time units return null)
 * @returns number of unit boundaries touched, or null on invalid input
 *
 * @example intervalCountDate("2024-01-01", "2024-01-03", "day") // 2
 * @example intervalCountDate("2024-01-15", "2024-03-10", "month") // 3
 * @example intervalCountDate("2024-01-15", "2024-01-15", "month") // 0 (zero-length: holds no instant)
 *  * @example intervalCountDate("2024-01-01", "2024-01-10", "hour") // null
 * @example intervalCountDate("invalid", "2024-01-10", "day") // null
 * @example intervalCountDate("2023-09-16[u-ca=hebrew]", "2024-10-03[u-ca=hebrew]", "month") // 13 (Hebrew leap year, measured in Hebrew)
 * @example intervalCountDate("2024-10-03[u-ca=hebrew]", "2024-11-03", "month") // null (different calendars)
 */
export function intervalCountDate(
  start: string,
  end: string,
  unit: string,
): number | null {
  if (typeof start !== "string" || typeof end !== "string") {
    return null;
  }

  if (!isValidCalendarDate(start) || !isValidCalendarDate(end)) {
    return null;
  }

  if (typeof unit !== "string") {
    return null;
  }

  const resolvedUnit = resolveDateTimeUnit(unit);

  if (!isValidDateUnit(resolvedUnit)) {
    return null;
  }

  try {
    const { a: startVal, b: endVal } = parseCalendarDatePairForArithmetic(
      start,
      end,
    );

    const order = Temporal.PlainDate.compare(startVal, endVal);

    if (order > 0) {
      return null;
    }

    // An empty interval [t, t) holds no instant, so it touches no unit (CORE-6 empty-interval rule).
    if (order === 0) {
      return 0;
    }

    const startOfEnd = startOfUnitIfRepresentable(endVal, resolvedUnit);

    // `end`'s unit began before the range, so `start` (<= `end`) is in it too, and `end` is not on
    // a boundary: one bucket.
    if (startOfEnd === null) {
      return 1;
    }

    const endBucket = startOfEnd.equals(endVal) ? 0 : 1;

    // `start` is already inside `end`'s unit: no boundary between them.
    if (Temporal.PlainDate.compare(startOfEnd, startVal) <= 0) {
      return endBucket;
    }

    // `start`'s unit, plus every whole unit from the next start up to `end`'s unit.
    const spanned =
      1 +
      getUnitSpan(
        Temporal.Duration.from(
          calendarDateUntil(
            getStartOfNextDateUnit(startVal, resolvedUnit),
            startOfEnd,
            resolvedUnit as CalendarDateUnit,
          ),
        ),
        resolvedUnit,
      );

    return spanned + endBucket;
  } catch {
    return null;
  }
}
