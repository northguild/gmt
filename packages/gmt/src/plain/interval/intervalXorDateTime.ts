import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../regex";

/**
 * Return the symmetric difference of two datetime intervals — time covered by exactly one interval.
 *
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Returns `[]` when intervals are identical or both invalid.
 * - Returns `[{ start, end }]` when one interval fully contains the other.
 * - Returns `[{ start, end }, { start, end }]` when intervals partially overlap.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 datetime string for the first interval start
 * @param aEnd ISO 8601 datetime string for the first interval end
 * @param bStart ISO 8601 datetime string for the second interval start
 * @param bEnd ISO 8601 datetime string for the second interval end
 * @returns array of `{ start, end }` records representing the symmetric difference, or `[]` on invalid input
 *
 * @example intervalXorDateTime("2024-01-01T09:00:00", "2024-06-30T12:00:00", "2024-04-01T11:00:00", "2024-12-31T17:00:00") // [{ start: "2024-01-01T09:00:00", end: "2024-03-31T17:00:00" }, { start: "2024-06-30T12:00:01", end: "2024-12-31T17:00:00" }]
 * @example intervalXorDateTime("2024-01-01T09:00:00", "2024-12-31T17:00:00", "2024-04-01T11:00:00", "2024-06-30T12:00:00") // [{ start: "2024-01-01T09:00:00", end: "2024-03-31T17:00:00" }, { start: "2024-06-30T12:00:01", end: "2024-12-31T17:00:00" }]
 * @example intervalXorDateTime("2024-01-01T09:00:00", "2024-12-31T17:00:00", "2024-01-01T09:00:00", "2024-12-31T17:00:00") // []
 * @example intervalXorDateTime("invalid", "2024-06-30T12:00:00", "2024-07-01T13:00:00", "2024-12-31T17:00:00") // []
 */
export function intervalXorDateTime(
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

    // If intervals don't overlap, return both as-is
    if (
      Temporal.PlainDateTime.compare(aE, bS) < 0 ||
      Temporal.PlainDateTime.compare(bE, aS) < 0
    ) {
      return [
        { start: aS.toString(), end: aE.toString() },
        { start: bS.toString(), end: bE.toString() },
      ];
    }

    // Left piece: A before B starts
    if (Temporal.PlainDateTime.compare(aS, bS) < 0) {
      result.push({
        start: aS.toString(),
        end: bS.subtract({ nanoseconds: 1 }).toString(),
      });
    }

    // Right piece: A after B ends
    if (Temporal.PlainDateTime.compare(aE, bE) > 0) {
      result.push({
        start: bE.add({ nanoseconds: 1 }).toString(),
        end: aE.toString(),
      });
    }

    // Left piece: B before A starts
    if (Temporal.PlainDateTime.compare(bS, aS) < 0) {
      result.push({
        start: bS.toString(),
        end: aS.subtract({ nanoseconds: 1 }).toString(),
      });
    }

    // Right piece: B after A ends
    if (Temporal.PlainDateTime.compare(bE, aE) > 0) {
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
