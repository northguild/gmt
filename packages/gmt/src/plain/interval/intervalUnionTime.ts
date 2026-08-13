import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";

/**
 * Return the combined span of two time intervals, or null when they are disjoint.
 *
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Overlapping intervals return their merged span.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one instant and ARE merged.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 time string for the first interval start
 * @param aEnd ISO 8601 time string for the first interval end
 * @param bStart ISO 8601 time string for the second interval start
 * @param bEnd ISO 8601 time string for the second interval end
 * @returns `{ start, end }` with the merged span, or null on invalid input / disjoint intervals
 *
 * @example intervalUnionTime("09:00:00", "17:00:00", "12:00:00", "18:00:00") // { start: "09:00:00", end: "18:00:00" }
 * @example intervalUnionTime("09:00:00", "17:00:00", "17:00:00", "18:00:00") // { start: "09:00:00", end: "18:00:00" }
 * @example intervalUnionTime("09:00:00", "17:00:00", "18:00:00", "20:00:00") // null
 * @example intervalUnionTime("invalid", "17:00:00", "12:00:00", "18:00:00") // null
 */
export function intervalUnionTime(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): { start: string; end: string } | null {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return null;
  }

  if (
    !plainTime.test(aStart) ||
    !plainTime.test(aEnd) ||
    !plainTime.test(bStart) ||
    !plainTime.test(bEnd)
  ) {
    return null;
  }

  try {
    const aS = Temporal.PlainTime.from(aStart);
    const aE = Temporal.PlainTime.from(aEnd);
    const bS = Temporal.PlainTime.from(bStart);
    const bE = Temporal.PlainTime.from(bEnd);

    if (Temporal.PlainTime.compare(aS, aE) > 0) {
      return null;
    }

    if (Temporal.PlainTime.compare(bS, bE) > 0) {
      return null;
    }

    if (
      Temporal.PlainTime.compare(aE, bS) < 0 ||
      Temporal.PlainTime.compare(bE, aS) < 0
    ) {
      return null;
    }

    const start = Temporal.PlainTime.compare(aS, bS) <= 0 ? aS : bS;
    const end = Temporal.PlainTime.compare(aE, bE) >= 0 ? aE : bE;

    return { start: start.toString(), end: end.toString() };
  } catch {
    return null;
  }
}
