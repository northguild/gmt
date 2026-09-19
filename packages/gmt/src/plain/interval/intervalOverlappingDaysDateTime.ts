// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenIntersection } from "../../internal";
import { isValidDateTime } from "../validate";

/**
 * Return how many distinct calendar dates two datetime intervals share.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`. The count is the number of
 *   calendar days holding at least one moment of the intersection `[max(aStart, bStart),
 *   min(aEnd, bEnd))`. An intersection ending exactly at midnight does not reach that day.
 * - Touching intervals (`aEnd === bStart`) share no moment and count `0`; so does an empty interval.
 * - Returns `0` when the intervals share nothing (a well-defined answer, not invalid input).
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 datetime string for the first interval start
 * @param aEnd ISO 8601 datetime string for the first interval end
 * @param bStart ISO 8601 datetime string for the second interval start
 * @param bEnd ISO 8601 datetime string for the second interval end
 * @returns number of shared calendar dates, `0` when disjoint, or null on invalid input
 *
 * @example intervalOverlappingDaysDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "2024-01-01T23:59:00", "2024-01-02T00:01:00") // 2
 * @example intervalOverlappingDaysDateTime("2024-01-01T00:00:00", "2024-01-05T00:00:00", "2024-01-03T12:00:00", "2024-01-09T00:00:00") // 2 (01-03 and 01-04; 01-05T00:00 is excluded)
 * @example intervalOverlappingDaysDateTime("2024-01-01T00:00:00", "2024-01-02T00:00:00", "2024-01-02T00:00:00", "2024-01-03T00:00:00") // 0 (touching)
 * @example intervalOverlappingDaysDateTime("invalid", "2024-06-30T23:59:59", "2024-04-01T00:00:00", "2024-12-31T23:59:59") // null
 */
export function intervalOverlappingDaysDateTime(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): number | null {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return null;
  }

  if (
    !isValidDateTime(aStart) ||
    !isValidDateTime(aEnd) ||
    !isValidDateTime(bStart) ||
    !isValidDateTime(bEnd)
  ) {
    return null;
  }

  try {
    const aS = Temporal.PlainDateTime.from(aStart);
    const aE = Temporal.PlainDateTime.from(aEnd);
    const bS = Temporal.PlainDateTime.from(bStart);
    const bE = Temporal.PlainDateTime.from(bEnd);

    if (Temporal.PlainDateTime.compare(aS, aE) > 0) {
      return null;
    }

    if (Temporal.PlainDateTime.compare(bS, bE) > 0) {
      return null;
    }

    const shared = halfOpenIntersection(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainDateTime.compare,
    );

    if (
      shared === null ||
      Temporal.PlainDateTime.compare(shared.start, shared.end) === 0
    ) {
      return 0;
    }

    const endsAtMidnight = shared.end
      .toPlainTime()
      .equals(new Temporal.PlainTime());
    const days = shared.start
      .toPlainDate()
      .until(shared.end.toPlainDate(), { largestUnit: "day" }).days;

    return endsAtMidnight ? days : days + 1;
  } catch {
    return null;
  }
}
