import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { utcDateTime } from "../../regex/utc-date-time";

/**
 * Return the symmetric difference of two UTC intervals — time covered by exactly one interval.
 *
 * - Uses `Temporal.Instant.compare` for comparison.
 * - Returns `[]` when intervals are identical or both invalid.
 * - Returns `[{ start, end }]` when one interval fully contains the other.
 * - Returns `[{ start, end }, { start, end }]` when intervals partially overlap.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 UTC datetime string for the first interval start
 * @param aEnd ISO 8601 UTC datetime string for the first interval end
 * @param bStart ISO 8601 UTC datetime string for the second interval start
 * @param bEnd ISO 8601 UTC datetime string for the second interval end
 * @returns array of `{ start, end }` records representing the symmetric difference, or `[]` on invalid input
 *
 * @example intervalXorUtc("2024-01-01T09:00:00Z", "2024-06-30T12:00:00Z", "2024-04-01T11:00:00Z", "2024-12-31T17:00:00Z") // [{ start: "2024-01-01T09:00:00Z", end: "2024-03-31T17:00:00Z" }, { start: "2024-06-30T12:00:01Z", end: "2024-12-31T17:00:00Z" }]
 * @example intervalXorUtc("2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z", "2024-04-01T11:00:00Z", "2024-06-30T12:00:00Z") // [{ start: "2024-01-01T09:00:00Z", end: "2024-03-31T17:00:00Z" }, { start: "2024-06-30T12:00:01Z", end: "2024-12-31T17:00:00Z" }]
 * @example intervalXorUtc("2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z", "2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z") // []
 * @example intervalXorUtc("invalid", "2024-06-30T12:00:00Z", "2024-07-01T13:00:00Z", "2024-12-31T17:00:00Z") // []
 */
export function intervalXorUtc(
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

    // If intervals don't overlap, return both as-is
    if (
      Temporal.Instant.compare(aE, bS) < 0 ||
      Temporal.Instant.compare(bE, aS) < 0
    ) {
      return [
        { start: aS.toString(), end: aE.toString() },
        { start: bS.toString(), end: bE.toString() },
      ];
    }

    // Left piece: A before B starts
    if (Temporal.Instant.compare(aS, bS) < 0) {
      result.push({
        start: aS.toString(),
        end: bS.subtract({ nanoseconds: 1 }).toString(),
      });
    }

    // Right piece: A after B ends
    if (Temporal.Instant.compare(aE, bE) > 0) {
      result.push({
        start: bE.add({ nanoseconds: 1 }).toString(),
        end: aE.toString(),
      });
    }

    // Left piece: B before A starts
    if (Temporal.Instant.compare(bS, aS) < 0) {
      result.push({
        start: bS.toString(),
        end: aS.subtract({ nanoseconds: 1 }).toString(),
      });
    }

    // Right piece: B after A ends
    if (Temporal.Instant.compare(bE, aE) > 0) {
      result.push({
        start: aE.add({ nanoseconds: 1 }).toString(),
        end: bE.toString(),
      });
    }

    return result;
  } catch {
    return [];
  }
}
