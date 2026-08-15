import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";

/**
 * Return true when interval B is fully contained within interval A — every instant of B
 * falls within A.
 *
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Equivalent to 4-argument `intervalContainsTime(aStart, aEnd, bStart, bEnd)`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 time string for the outer interval start
 * @param aEnd ISO 8601 time string for the outer interval end
 * @param bStart ISO 8601 time string for the inner interval start
 * @param bEnd ISO 8601 time string for the inner interval end
 * @returns true if B is fully contained in A, or false on invalid input
 *
 * @example intervalEngulfsTime("09:00:00", "17:00:00", "12:00:00", "13:00:00") // true
 * @example intervalEngulfsTime("09:00:00", "17:00:00", "09:00:00", "17:00:00") // true (equal intervals)
 * @example intervalEngulfsTime("09:00:00", "17:00:00", "09:00:00", "12:00:00") // true
 * @example intervalEngulfsTime("12:00:00", "13:00:00", "09:00:00", "17:00:00") // false
 * @example intervalEngulfsTime("invalid", "17:00:00", "12:00:00", "13:00:00") // false
 */
export function intervalEngulfsTime(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return false;
  }

  if (
    !plainTime.test(aStart) ||
    !plainTime.test(aEnd) ||
    !plainTime.test(bStart) ||
    !plainTime.test(bEnd)
  ) {
    return false;
  }

  try {
    const aS = Temporal.PlainTime.from(aStart);
    const aE = Temporal.PlainTime.from(aEnd);
    const bS = Temporal.PlainTime.from(bStart);
    const bE = Temporal.PlainTime.from(bEnd);

    if (Temporal.PlainTime.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.PlainTime.compare(bS, bE) > 0) {
      return false;
    }

    return (
      Temporal.PlainTime.compare(aS, bS) <= 0 &&
      Temporal.PlainTime.compare(bE, aE) <= 0
    );
  } catch {
    return false;
  }
}
