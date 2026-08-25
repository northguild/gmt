import { Temporal } from "@js-temporal/polyfill";
import {
  getUnitSpan,
  parseCalendarDatePairForArithmetic,
  resolveDateTimeUnit,
} from "../../internal";
import { getStartOfDateUnit } from "../../internal/dateUnitHelpers";
import { isValidCalendarDate, isValidDateUnit } from "../validate";

/**
 * Count how many `unit` boundaries a date interval crosses.
 *
 * - Counts calendar boundaries touched by the half-open interval `[start, end)` — distinct
 *   from `diffDate`, which measures exact elapsed duration.
 * - `"2024-01-01"` to `"2024-01-03"` counted in days is 2: the end boundary is excluded.
 * - A zero-length interval counts 1 when it sits mid-unit and 0 when it sits exactly on a
 *   unit boundary (e.g. `"2024-01-15"` counts 1 month but 0 days).
 * - Weeks start on Monday (ISO 8601).
 * - Accepts singular or plural units (`"day"` and `"days"` behave identically).
 * - Returns `null` on invalid input (unparseable start/end, `start > end`, unsupported unit,
 *   or a unit that has no effect on `PlainDate`, e.g. `"hours"`).
 * - Accepts GMT calendar-annotated PlainDate strings — E5 (issue #78). When `start` and `end`
 *   carry the *same* calendar tag, boundaries are counted in that calendar (a Hebrew leap year
 *   crosses 13 month boundaries, not 12 — see the roadmap's E5 decisions of record, D5). When
 *   they carry different tags (or either is bare ISO), counting falls back to Gregorian.
 *
 * @param start ISO PlainDate string for the interval start, optionally calendar-annotated
 * @param end ISO PlainDate string for the interval end, optionally calendar-annotated
 * @param unit unit string — `"year" | "month" | "week" | "day"` (time units return null)
 * @returns number of unit boundaries touched, or null on invalid input
 *
 * @example intervalCountDate("2024-01-01", "2024-01-03", "day") // 2
 * @example intervalCountDate("2024-01-15", "2024-03-10", "month") // 3
 * @example intervalCountDate("2024-01-15", "2024-01-15", "month") // 1 (zero-length, mid-month)
 * @example intervalCountDate("2024-01-01", "2024-01-01", "month") // 0 (zero-length, on the boundary)
 * @example intervalCountDate("2024-01-01", "2024-01-10", "hour") // null
 * @example intervalCountDate("invalid", "2024-01-10", "day") // null
 * @example intervalCountDate("5784-01-01[u-ca=hebrew]", "5785-01-01[u-ca=hebrew]", "month") // 13 (Hebrew leap year, measured in Hebrew)
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

    if (Temporal.PlainDate.compare(startVal, endVal) > 0) {
      return null;
    }

    const startOfStart = getStartOfDateUnit(startVal, resolvedUnit);
    const startOfEnd = getStartOfDateUnit(endVal, resolvedUnit);

    const spanned = getUnitSpan(
      startOfStart.until(startOfEnd, { largestUnit: resolvedUnit }),
      resolvedUnit,
    );

    return spanned + (startOfEnd.equals(endVal) ? 0 : 1);
  } catch {
    return null;
  }
}
