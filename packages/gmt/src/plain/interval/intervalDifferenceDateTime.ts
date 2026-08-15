import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../regex";

/**
 * Return the portion(s) of interval A not covered by interval B.
 *
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Returns `[]` when B fully covers A.
 * - Returns `[{ start, end }]` when B overlaps one edge of A (or equals A).
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 datetime string for the first interval start
 * @param aEnd ISO 8601 datetime string for the first interval end
 * @param bStart ISO 8601 datetime string for the second interval start
 * @param bEnd ISO 8601 datetime string for the second interval end
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input
 *
 * @example intervalDifferenceDateTime("2024-01-01T09:00:00", "2024-12-31T17:00:00", "2024-06-01T12:00:00", "2024-07-01T13:00:00") // [{ start: "2024-01-01T09:00:00", end: "2024-05-31T17:00:00" }, { start: "2024-07-01T13:00:01", end: "2024-12-31T17:00:00" }]
 * @example intervalDifferenceDateTime("2024-01-01T09:00:00", "2024-12-31T17:00:00", "2024-01-01T09:00:00", "2024-12-31T17:00:00") // []
 * @example intervalDifferenceDateTime("invalid", "2024-12-31T17:00:00", "2024-06-01T12:00:00", "2024-07-01T13:00:00") // []
 */
export function intervalDifferenceDateTime(
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
    !plainDateTime.test(aStart) ||
    !plainDateTime.test(aEnd) ||
    !plainDateTime.test(bStart) ||
    !plainDateTime.test(bEnd)
  ) {
    return [];
  }

  try {
    const aS = Temporal.PlainDateTime.from(aStart);
    const aE = Temporal.PlainDateTime.from(aEnd);
    const bS = Temporal.PlainDateTime.from(bStart);
    const bE = Temporal.PlainDateTime.from(bEnd);

    if (Temporal.PlainDateTime.compare(aS, aE) > 0) {
      return [];
    }

    if (Temporal.PlainDateTime.compare(bS, bE) > 0) {
      return [];
    }

    const result: Array<{ start: string; end: string }> = [];

    // Left piece: A before B starts
    if (Temporal.PlainDateTime.compare(aS, bS) < 0) {
      const leftEnd =
        Temporal.PlainDateTime.compare(aE, bS) < 0
          ? aE
          : bS.subtract({ nanoseconds: 1 });
      if (Temporal.PlainDateTime.compare(leftEnd, aS) >= 0) {
        result.push({ start: aS.toString(), end: leftEnd.toString() });
      }
    }

    // Right piece: A after B ends
    if (Temporal.PlainDateTime.compare(aE, bE) > 0) {
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
