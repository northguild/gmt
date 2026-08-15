import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { utcDateTime } from "../../regex/utc-date-time";

/**
 * Return the portion(s) of interval A not covered by interval B.
 *
 * - Uses `Temporal.Instant.compare` for comparison.
 * - Returns `[]` when B fully covers A.
 * - Returns `[{ start, end }]` when B overlaps one edge of A (or equals A).
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 UTC datetime string for the first interval start
 * @param aEnd ISO 8601 UTC datetime string for the first interval end
 * @param bStart ISO 8601 UTC datetime string for the second interval start
 * @param bEnd ISO 8601 UTC datetime string for the second interval end
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input
 *
 * @example intervalDifferenceUtc("2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z", "2024-06-01T12:00:00Z", "2024-07-01T13:00:00Z") // [{ start: "2024-01-01T09:00:00Z", end: "2024-05-31T17:00:00Z" }, { start: "2024-07-01T13:00:01Z", end: "2024-12-31T17:00:00Z" }]
 * @example intervalDifferenceUtc("2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z", "2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z") // []
 * @example intervalDifferenceUtc("invalid", "2024-12-31T17:00:00Z", "2024-06-01T12:00:00Z", "2024-07-01T13:00:00Z") // []
 */
export function intervalDifferenceUtc(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): Array<{ start: string; end: string }> {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return [];
  }

  if (
    !utcDateTime.test(aStart) ||
    !utcDateTime.test(aEnd) ||
    !utcDateTime.test(bStart) ||
    !utcDateTime.test(bEnd)
  ) {
    return [];
  }

  if (
    isLeapSecond(aStart) ||
    isLeapSecond(aEnd) ||
    isLeapSecond(bStart) ||
    isLeapSecond(bEnd)
  ) {
    return [];
  }

  try {
    const aS = Temporal.Instant.from(aStart);
    const aE = Temporal.Instant.from(aEnd);
    const bS = Temporal.Instant.from(bStart);
    const bE = Temporal.Instant.from(bEnd);

    if (Temporal.Instant.compare(aS, aE) > 0) {
      return [];
    }

    if (Temporal.Instant.compare(bS, bE) > 0) {
      return [];
    }

    const result: Array<{ start: string; end: string }> = [];

    // Left piece: A before B starts
    if (Temporal.Instant.compare(aS, bS) < 0) {
      const leftEnd =
        Temporal.Instant.compare(aE, bS) < 0
          ? aE
          : bS.subtract({ nanoseconds: 1 });
      if (Temporal.Instant.compare(leftEnd, aS) >= 0) {
        result.push({ start: aS.toString(), end: leftEnd.toString() });
      }
    }

    // Right piece: A after B ends
    if (Temporal.Instant.compare(aE, bE) > 0) {
      result.push({
        start: bE.add({ nanoseconds: 1 }).toString(),
        end: aE.toString(),
      });
    }

    return result;
  } catch {
    return [];
  }
}
