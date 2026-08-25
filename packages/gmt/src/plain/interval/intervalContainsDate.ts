import { Temporal } from "@js-temporal/polyfill";
import { parseCalendarDateValue } from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return true when `pointOrStart` falls within the interval `[intervalStart, intervalEnd]`
 * (3-arg), or when the inner interval `[innerStart, innerEnd]` is fully contained within
 * the outer interval `[intervalStart, intervalEnd]` (4-arg).
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Always-inclusive boundaries: `start <= point <= end`.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 * - Accepts GMT calendar-annotated PlainDate strings — E5 (issue #78). Ordering is
 *   calendar-independent, so arguments may carry different or no calendar tags (D4).
 *
 * @param intervalStart ISO 8601 date string for the outer interval start, optionally calendar-annotated
 * @param intervalEnd ISO 8601 date string for the outer interval end, optionally calendar-annotated
 * @param pointOrStart ISO 8601 date string for the point (3-arg) or inner start (4-arg), optionally calendar-annotated
 * @param pointEnd optional ISO 8601 date string for the inner interval end (4-arg mode), optionally calendar-annotated
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15") // true
 * @example intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15", "2024-07-15") // true
 * @example intervalContainsDate("2024-12-31", "2024-01-01", "2024-06-15") // false
 * @example intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15", "2024-06-10") // false
 * @example intervalContainsDate("invalid", "2024-12-31", "2024-06-15") // false
 */
export function intervalContainsDate(
  intervalStart: string,
  intervalEnd: string,
  pointOrStart: string,
  pointEnd?: string,
): boolean {
  if (
    typeof intervalStart !== "string" ||
    typeof intervalEnd !== "string" ||
    typeof pointOrStart !== "string" ||
    (pointEnd !== undefined && typeof pointEnd !== "string")
  ) {
    return false;
  }

  if (
    !isValidCalendarDate(intervalStart) ||
    !isValidCalendarDate(intervalEnd) ||
    !isValidCalendarDate(pointOrStart) ||
    (pointEnd !== undefined && !isValidCalendarDate(pointEnd))
  ) {
    return false;
  }

  try {
    const s = parseCalendarDateValue(intervalStart);
    const e = parseCalendarDateValue(intervalEnd);
    const p = parseCalendarDateValue(pointOrStart);

    if (Temporal.PlainDate.compare(s, e) > 0) {
      return false;
    }

    if (pointEnd === undefined) {
      return (
        Temporal.PlainDate.compare(s, p) <= 0 &&
        Temporal.PlainDate.compare(p, e) <= 0
      );
    }

    const pe = parseCalendarDateValue(pointEnd);

    if (Temporal.PlainDate.compare(p, pe) > 0) {
      return false;
    }

    return (
      Temporal.PlainDate.compare(s, p) <= 0 &&
      Temporal.PlainDate.compare(pe, e) <= 0
    );
  } catch {
    return false;
  }
}
