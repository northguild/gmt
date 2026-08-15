import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";

/**
 * Return the portion(s) of interval A not covered by interval B.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Returns `[]` when B fully covers A.
 * - Returns `[{ start, end }]` when B overlaps one edge of A (or equals A).
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 date string for the first interval start
 * @param aEnd ISO 8601 date string for the first interval end
 * @param bStart ISO 8601 date string for the second interval start
 * @param bEnd ISO 8601 date string for the second interval end
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input
 *
 * @example intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01") // [{ start: "2024-01-01", end: "2024-05-31" }, { start: "2024-07-02", end: "2024-12-31" }]
 * @example intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-03-01", "2024-10-31") // [{ start: "2024-01-01", end: "2024-02-29" }, { start: "2024-11-01", end: "2024-12-31" }]
 * @example intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31") // []
 * @example intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-12-31") // [{ start: "2024-01-01", end: "2024-05-31" }]
 * @example intervalDifferenceDate("invalid", "2024-12-31", "2024-06-01", "2024-07-01") // []
 */
export function intervalDifferenceDate(
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

    // Left piece: A before B starts
    if (Temporal.PlainDate.compare(aS, bS) < 0) {
      const leftEnd =
        Temporal.PlainDate.compare(
          Temporal.PlainDate.compare(aE, bS) < 0
            ? aE
            : bS.subtract({ days: 1 }),
          aS,
        ) >= 0
          ? Temporal.PlainDate.compare(aE, bS) < 0
            ? aE
            : bS.subtract({ days: 1 })
          : null;

      if (leftEnd !== null && Temporal.PlainDate.compare(leftEnd, aS) >= 0) {
        result.push({ start: aS.toString(), end: leftEnd.toString() });
      }
    }

    // Right piece: A after B ends
    if (Temporal.PlainDate.compare(aE, bE) > 0) {
      result.push({
        start: bE.add({ days: 1 }).toString(),
        end: aE.toString(),
      });
    }

    return result;
  } catch {
    return [];
  }
}
