import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";

/**
 * Return true when `pointOrStart` falls within the interval `[intervalStart, intervalEnd]`
 * (3-arg), or when the inner interval `[innerStart, innerEnd]` is fully contained within
 * the outer interval `[intervalStart, intervalEnd]` (4-arg).
 *
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Always-inclusive boundaries: `start <= point <= end`.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 *
 * @param intervalStart ISO 8601 time string for the outer interval start
 * @param intervalEnd ISO 8601 time string for the outer interval end
 * @param pointOrStart ISO 8601 time string for the point (3-arg) or inner start (4-arg)
 * @param pointEnd optional ISO 8601 time string for the inner interval end (4-arg mode)
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsTime("09:00:00", "17:00:00", "12:00:00") // true
 * @example intervalContainsTime("09:00:00", "17:00:00", "12:00:00", "13:00:00") // true
 * @example intervalContainsTime("17:00:00", "09:00:00", "12:00:00") // false
 * @example intervalContainsTime("09:00:00", "17:00:00", "12:00:00", "11:00:00") // false
 * @example intervalContainsTime("invalid", "17:00:00", "12:00:00") // false
 */
export function intervalContainsTime(
  intervalStart: string,
  intervalEnd: string,
  pointOrStart: string,
  pointEnd?: string,
): boolean {
  if (
    typeof intervalStart !== "string" ||
    typeof intervalEnd !== "string" ||
    typeof pointOrStart !== "string" ||
    (pointEnd !== undefined && typeof pointEnd !== "string")
  ) {
    return false;
  }

  if (
    !plainTime.test(intervalStart) ||
    !plainTime.test(intervalEnd) ||
    !plainTime.test(pointOrStart) ||
    (pointEnd !== undefined && !plainTime.test(pointEnd))
  ) {
    return false;
  }

  try {
    const s = Temporal.PlainTime.from(intervalStart);
    const e = Temporal.PlainTime.from(intervalEnd);
    const p = Temporal.PlainTime.from(pointOrStart);

    if (Temporal.PlainTime.compare(s, e) > 0) {
      return false;
    }

    if (pointEnd === undefined) {
      return (
        Temporal.PlainTime.compare(s, p) <= 0 &&
        Temporal.PlainTime.compare(p, e) <= 0
      );
    }

    const pe = Temporal.PlainTime.from(pointEnd);

    if (Temporal.PlainTime.compare(p, pe) > 0) {
      return false;
    }

    return (
      Temporal.PlainTime.compare(s, p) <= 0 &&
      Temporal.PlainTime.compare(pe, e) <= 0
    );
  } catch {
    return false;
  }
}
