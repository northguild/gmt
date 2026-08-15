import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";

/**
 * Return the portion(s) of interval A not covered by interval B.
 *
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Returns `[]` when B fully covers A.
 * - Returns `[{ start, end }]` when B overlaps one edge of A (or equals A).
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 time string for the first interval start
 * @param aEnd ISO 8601 time string for the first interval end
 * @param bStart ISO 8601 time string for the second interval start
 * @param bEnd ISO 8601 time string for the second interval end
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input
 *
 * @example intervalDifferenceTime("09:00:00", "17:00:00", "12:00:00", "13:00:00") // [{ start: "09:00:00", end: "11:59:59" }, { start: "13:00:01", end: "17:00:00" }]
 * @example intervalDifferenceTime("09:00:00", "17:00:00", "09:00:00", "17:00:00") // []
 * @example intervalDifferenceTime("09:00:00", "17:00:00", "12:00:00", "17:00:00") // [{ start: "09:00:00", end: "11:59:59" }]
 * @example intervalDifferenceTime("invalid", "17:00:00", "12:00:00", "13:00:00") // []
 */
export function intervalDifferenceTime(
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
    !plainTime.test(aStart) ||
    !plainTime.test(aEnd) ||
    !plainTime.test(bStart) ||
    !plainTime.test(bEnd)
  ) {
    return [];
  }

  try {
    const aS = Temporal.PlainTime.from(aStart);
    const aE = Temporal.PlainTime.from(aEnd);
    const bS = Temporal.PlainTime.from(bStart);
    const bE = Temporal.PlainTime.from(bEnd);

    if (Temporal.PlainTime.compare(aS, aE) > 0) {
      return [];
    }

    if (Temporal.PlainTime.compare(bS, bE) > 0) {
      return [];
    }

    const result: Array<{ start: string; end: string }> = [];

    // Left piece: A before B starts
    if (Temporal.PlainTime.compare(aS, bS) < 0) {
      const leftEnd =
        Temporal.PlainTime.compare(aE, bS) < 0
          ? aE
          : bS.subtract({ nanoseconds: 1 });
      if (Temporal.PlainTime.compare(leftEnd, aS) >= 0) {
        result.push({ start: aS.toString(), end: leftEnd.toString() });
      }
    }

    // Right piece: A after B ends
    if (Temporal.PlainTime.compare(aE, bE) > 0) {
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
