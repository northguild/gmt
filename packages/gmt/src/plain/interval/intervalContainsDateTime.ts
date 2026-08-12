import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../regex";

/**
 * Return true when `pointOrStart` falls within the interval `[intervalStart, intervalEnd]`
 * (3-arg), or when the inner interval `[innerStart, innerEnd]` is fully contained within
 * the outer interval `[intervalStart, intervalEnd]` (4-arg).
 *
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Always-inclusive boundaries: `start <= point <= end`.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 *
 * @param intervalStart ISO 8601 datetime string for the outer interval start
 * @param intervalEnd ISO 8601 datetime string for the outer interval end
 * @param pointOrStart ISO 8601 datetime string for the point (3-arg) or inner start (4-arg)
 * @param pointEnd optional ISO 8601 datetime string for the inner interval end (4-arg mode)
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsDateTime("2024-01-01T10:00:00", "2024-12-31T23:59:59", "2024-06-15T12:00:00") // true
 * @example intervalContainsDateTime("2024-01-01T10:00:00", "2024-12-31T23:59:59", "2024-06-15T12:00:00", "2024-07-15T12:00:00") // true
 * @example intervalContainsDateTime("2024-12-31T23:59:59", "2024-01-01T10:00:00", "2024-06-15T12:00:00") // false
 * @example intervalContainsDateTime("2024-01-01T10:00:00", "2024-12-31T23:59:59", "2024-06-15T12:00:00", "2024-06-10T12:00:00") // false
 * @example intervalContainsDateTime("invalid", "2024-12-31T23:59:59", "2024-06-15T12:00:00") // false
 */
export function intervalContainsDateTime(
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
    !plainDateTime.test(intervalStart) ||
    !plainDateTime.test(intervalEnd) ||
    !plainDateTime.test(pointOrStart) ||
    (pointEnd !== undefined && !plainDateTime.test(pointEnd))
  ) {
    return false;
  }

  try {
    const s = Temporal.PlainDateTime.from(intervalStart);
    const e = Temporal.PlainDateTime.from(intervalEnd);
    const p = Temporal.PlainDateTime.from(pointOrStart);

    if (Temporal.PlainDateTime.compare(s, e) > 0) {
      return false;
    }

    if (pointEnd === undefined) {
      return (
        Temporal.PlainDateTime.compare(s, p) <= 0 &&
        Temporal.PlainDateTime.compare(p, e) <= 0
      );
    }

    const pe = Temporal.PlainDateTime.from(pointEnd);

    if (Temporal.PlainDateTime.compare(p, pe) > 0) {
      return false;
    }

    return (
      Temporal.PlainDateTime.compare(s, p) <= 0 &&
      Temporal.PlainDateTime.compare(pe, e) <= 0
    );
  } catch {
    return false;
  }
}
