import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";

/**
 * Return true when `pointOrStart` falls within the interval `[intervalStart, intervalEnd]`
 * (3-arg), or when the inner interval `[innerStart, innerEnd]` is fully contained within
 * the outer interval `[intervalStart, intervalEnd]` (4-arg).
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Always-inclusive boundaries: `start <= point <= end`.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param intervalStart ISO 8601 date string for the outer interval start
 * @param intervalEnd ISO 8601 date string for the outer interval end
 * @param pointOrStart ISO 8601 date string for the point (3-arg) or inner start (4-arg)
 * @param pointEnd optional ISO 8601 date string for the inner interval end (4-arg mode)
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15") // true
 * @example intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15", "2024-07-15") // true
 * @example intervalContainsDate("2024-12-31", "2024-01-01", "2024-06-15") // false
 * @example intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15", "2024-06-10") // false
 * @example intervalContainsDate("invalid", "2024-12-31", "2024-06-15") // false
 */
export function intervalContainsDate(
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
    !plainDate.test(intervalStart) ||
    !plainDate.test(intervalEnd) ||
    !plainDate.test(pointOrStart) ||
    (pointEnd !== undefined && !plainDate.test(pointEnd))
  ) {
    return false;
  }

  try {
    const s = Temporal.PlainDate.from(intervalStart);
    const e = Temporal.PlainDate.from(intervalEnd);
    const p = Temporal.PlainDate.from(pointOrStart);

    if (Temporal.PlainDate.compare(s, e) > 0) {
      return false;
    }

    if (pointEnd === undefined) {
      return (
        Temporal.PlainDate.compare(s, p) <= 0 &&
        Temporal.PlainDate.compare(p, e) <= 0
      );
    }

    const pe = Temporal.PlainDate.from(pointEnd);

    if (Temporal.PlainDate.compare(p, pe) > 0) {
      return false;
    }

    return (
      Temporal.PlainDate.compare(s, p) <= 0 &&
      Temporal.PlainDate.compare(pe, e) <= 0
    );
  } catch {
    return false;
  }
}
