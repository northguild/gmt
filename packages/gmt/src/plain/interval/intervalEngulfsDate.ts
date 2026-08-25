import { Temporal } from "@js-temporal/polyfill";
import { parseCalendarDateValue } from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return true when interval B is fully contained within interval A — every instant of B
 * falls within A.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Equivalent to 4-argument `intervalContainsDate(aStart, aEnd, bStart, bEnd)`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 * - Accepts GMT calendar-annotated PlainDate strings — E5 (issue #78). Ordering is
 *   calendar-independent, so arguments may carry different or no calendar tags (D4).
 *
 * @param aStart ISO 8601 date string for the outer interval start, optionally calendar-annotated
 * @param aEnd ISO 8601 date string for the outer interval end, optionally calendar-annotated
 * @param bStart ISO 8601 date string for the inner interval start, optionally calendar-annotated
 * @param bEnd ISO 8601 date string for the inner interval end, optionally calendar-annotated
 * @returns true if B is fully contained in A, or false on invalid input
 *
 * @example intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01") // true
 * @example intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31") // true (equal intervals)
 * @example intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-12-31") // true
 * @example intervalEngulfsDate("2024-06-01", "2024-07-01", "2024-01-01", "2024-12-31") // false
 * @example intervalEngulfsDate("invalid", "2024-12-31", "2024-06-01", "2024-07-01") // false
 */
export function intervalEngulfsDate(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return false;
  }

  if (
    !isValidCalendarDate(aStart) ||
    !isValidCalendarDate(aEnd) ||
    !isValidCalendarDate(bStart) ||
    !isValidCalendarDate(bEnd)
  ) {
    return false;
  }

  try {
    const aS = parseCalendarDateValue(aStart);
    const aE = parseCalendarDateValue(aEnd);
    const bS = parseCalendarDateValue(bStart);
    const bE = parseCalendarDateValue(bEnd);

    if (Temporal.PlainDate.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.PlainDate.compare(bS, bE) > 0) {
      return false;
    }

    return (
      Temporal.PlainDate.compare(aS, bS) <= 0 &&
      Temporal.PlainDate.compare(bE, aE) <= 0
    );
  } catch {
    return false;
  }
}
