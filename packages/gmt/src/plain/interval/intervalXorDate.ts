import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";

/**
 * Return the symmetric difference of two date intervals — time covered by exactly one interval.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Returns `[]` when intervals are identical or both invalid.
 * - Returns `[{ start, end }]` when one interval fully contains the other.
 * - Returns `[{ start, end }, { start, end }]` when intervals partially overlap (two non-overlapping pieces).
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 date string for the first interval start
 * @param aEnd ISO 8601 date string for the first interval end
 * @param bStart ISO 8601 date string for the second interval start
 * @param bEnd ISO 8601 date string for the second interval end
 * @returns array of `{ start, end }` records representing the symmetric difference, or `[]` on invalid input
 *
 * @example intervalXorDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31") // [{ start: "2024-01-01", end: "2024-03-31" }, { start: "2024-07-01", end: "2024-12-31" }]
 * @example intervalXorDate("2024-01-01", "2024-12-31", "2024-04-01", "2024-06-30") // [{ start: "2024-01-01", end: "2024-03-31" }, { start: "2024-07-01", end: "2024-12-31" }]
 * @example intervalXorDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31") // []
 * @example intervalXorDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31") // [{ start: "2024-01-01", end: "2024-06-30" }, { start: "2024-07-01", end: "2024-12-31" }]
 * @example intervalXorDate("invalid", "2024-06-30", "2024-07-01", "2024-12-31") // []
 */
export function intervalXorDate(
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
    !plainDate.test(aStart) ||
    !plainDate.test(aEnd) ||
    !plainDate.test(bStart) ||
    !plainDate.test(bEnd)
  ) {
    return [];
  }

  try {
    const aS = Temporal.PlainDate.from(aStart);
    const aE = Temporal.PlainDate.from(aEnd);
    const bS = Temporal.PlainDate.from(bStart);
    const bE = Temporal.PlainDate.from(bEnd);

    if (Temporal.PlainDate.compare(aS, aE) > 0) {
      return [];
    }

    if (Temporal.PlainDate.compare(bS, bE) > 0) {
      return [];
    }

    const result: Array<{ start: string; end: string }> = [];

    // If intervals don't overlap, return both as-is
    if (
      Temporal.PlainDate.compare(aE, bS) < 0 ||
      Temporal.PlainDate.compare(bE, aS) < 0
    ) {
      return [
        { start: aS.toString(), end: aE.toString() },
        { start: bS.toString(), end: bE.toString() },
      ];
    }

    // Left piece: A before B starts
    if (Temporal.PlainDate.compare(aS, bS) < 0) {
      result.push({
        start: aS.toString(),
        end: bS.subtract({ days: 1 }).toString(),
      });
    }

    // Right piece: A after B ends
    if (Temporal.PlainDate.compare(aE, bE) > 0) {
      result.push({
        start: bE.add({ days: 1 }).toString(),
        end: aE.toString(),
      });
    }

    // Left piece: B before A starts
    if (Temporal.PlainDate.compare(bS, aS) < 0) {
      result.push({
        start: bS.toString(),
        end: aS.subtract({ days: 1 }).toString(),
      });
    }

    // Right piece: B after A ends
    if (Temporal.PlainDate.compare(bE, aE) > 0) {
      result.push({
        start: aE.add({ days: 1 }).toString(),
        end: bE.toString(),
      });
    }

    return result;
  } catch {
    return [];
  }
}
