import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";

/**
 * Return the symmetric difference of two time intervals — time covered by exactly one interval.
 *
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Returns `[]` when intervals are identical or both invalid.
 * - Returns `[{ start, end }]` when one interval fully contains the other.
 * - Returns `[{ start, end }, { start, end }]` when intervals partially overlap.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 time string for the first interval start
 * @param aEnd ISO 8601 time string for the first interval end
 * @param bStart ISO 8601 time string for the second interval start
 * @param bEnd ISO 8601 time string for the second interval end
 * @returns array of `{ start, end }` records representing the symmetric difference, or `[]` on invalid input
 *
 * @example intervalXorTime("09:00:00", "12:00:00", "11:00:00", "17:00:00") // [{ start: "09:00:00", end: "10:59:59" }, { start: "12:00:01", end: "17:00:00" }]
 * @example intervalXorTime("09:00:00", "17:00:00", "11:00:00", "12:00:00") // [{ start: "09:00:00", end: "10:59:59" }, { start: "12:00:01", end: "17:00:00" }]
 * @example intervalXorTime("09:00:00", "17:00:00", "09:00:00", "17:00:00") // []
 * @example intervalXorTime("09:00:00", "12:00:00", "13:00:00", "17:00:00") // [{ start: "09:00:00", end: "12:00:00" }, { start: "13:00:00", end: "17:00:00" }]
 * @example intervalXorTime("invalid", "12:00:00", "13:00:00", "17:00:00") // []
 */
export function intervalXorTime(
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

    // If intervals don't overlap, return both as-is
    if (
      Temporal.PlainTime.compare(aE, bS) < 0 ||
      Temporal.PlainTime.compare(bE, aS) < 0
    ) {
      return [
        { start: aS.toString(), end: aE.toString() },
        { start: bS.toString(), end: bE.toString() },
      ];
    }

    // Left piece: A before B starts
    if (Temporal.PlainTime.compare(aS, bS) < 0) {
      result.push({
        start: aS.toString(),
        end: bS.subtract({ nanoseconds: 1 }).toString(),
      });
    }

    // Right piece: A after B ends
    if (Temporal.PlainTime.compare(aE, bE) > 0) {
      result.push({
        start: bE.add({ nanoseconds: 1 }).toString(),
        end: aE.toString(),
      });
    }

    // Left piece: B before A starts
    if (Temporal.PlainTime.compare(bS, aS) < 0) {
      result.push({
        start: bS.toString(),
        end: aS.subtract({ nanoseconds: 1 }).toString(),
      });
    }

    // Right piece: B after A ends
    if (Temporal.PlainTime.compare(bE, aE) > 0) {
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
