// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenIntersection } from "../../internal";
import { isValidUtc } from "../validate";

/**
 * Return how many distinct UTC calendar dates two UTC intervals share.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`. The count is the number of
 *   calendar days holding at least one instant of the intersection `[max(aStart, bStart),
 *   min(aEnd, bEnd))`. An intersection ending exactly at midnight does not reach that day.
 * - Touching intervals (`aEnd === bStart`) share no instant and count `0`; so does an empty interval.
 * - Returns `0` when the intervals share nothing (a well-defined answer, not invalid input).
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 UTC datetime string for the first interval start
 * @param aEnd ISO 8601 UTC datetime string for the first interval end
 * @param bStart ISO 8601 UTC datetime string for the second interval start
 * @param bEnd ISO 8601 UTC datetime string for the second interval end
 * @returns number of shared calendar dates, `0` when disjoint, or null on invalid input
 *
 * @example intervalOverlappingDaysUtc("2024-01-01T23:59:00Z", "2024-01-02T00:01:00Z", "2024-01-01T23:59:00Z", "2024-01-02T00:01:00Z") // 2
 * @example intervalOverlappingDaysUtc("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z") // 1
 * @example intervalOverlappingDaysUtc("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "2024-01-02T00:00:00Z", "2024-01-03T00:00:00Z") // 0 (touching)
 * @example intervalOverlappingDaysUtc("invalid", "2024-06-30T23:59:59Z", "2024-04-01T00:00:00Z", "2024-12-31T23:59:59Z") // null
 */
export function intervalOverlappingDaysUtc(
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
    !isValidUtc(aStart) ||
    !isValidUtc(aEnd) ||
    !isValidUtc(bStart) ||
    !isValidUtc(bEnd)
  ) {
    return null;
  }

  try {
    const aS = Temporal.Instant.from(aStart);
    const aE = Temporal.Instant.from(aEnd);
    const bS = Temporal.Instant.from(bStart);
    const bE = Temporal.Instant.from(bEnd);

    if (
      Temporal.Instant.compare(aS, aE) > 0 ||
      Temporal.Instant.compare(bS, bE) > 0
    ) {
      return null;
    }

    const shared = halfOpenIntersection(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.Instant.compare,
    );

    if (shared === null || shared.start.equals(shared.end)) {
      return 0;
    }

    const start = shared.start.toZonedDateTimeISO("UTC");
    const end = shared.end.toZonedDateTimeISO("UTC");
    const endsAtMidnight = end.toPlainTime().equals(new Temporal.PlainTime());
    const days = start
      .toPlainDate()
      .until(end.toPlainDate(), { largestUnit: "day" }).days;

    return endsAtMidnight ? days : days + 1;
  } catch {
    return null;
  }
}
