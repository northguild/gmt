import { Temporal } from "@js-temporal/polyfill";
import { closedIntervalsAbut } from "../../internal";
import { plainDateTime } from "../../regex";

/**
 * Return true when two datetime intervals are exactly adjacent — one's end is one nanosecond
 * before the other's start, so they share no instant and leave no gap.
 *
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Returns `true` when `bStart - 1 nanosecond === aEnd` (with `aEnd < bStart`) or
 *   `aStart - 1 nanosecond === bEnd` (with `bEnd < aStart`). The step is taken down from the later
 *   start, so an interval ending at the last representable value still abuts.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 datetime string for the first interval start
 * @param aEnd ISO 8601 datetime string for the first interval end
 * @param bStart ISO 8601 datetime string for the second interval start
 * @param bEnd ISO 8601 datetime string for the second interval end
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsDateTime("2024-01-01T09:00:00", "2024-06-30T12:00:00", "2024-06-30T12:00:00.000000001", "2024-12-31T17:00:00") // true
 * @example intervalAbutsDateTime("2024-06-30T12:00:00.000000001", "2024-12-31T17:00:00", "2024-01-01T09:00:00", "2024-06-30T12:00:00") // true
 * @example intervalAbutsDateTime("2024-01-01T09:00:00", "2024-06-30T12:00:00", "2024-06-30T12:00:01", "2024-12-31T17:00:00") // false (gap)
 * @example intervalAbutsDateTime("2024-01-01T09:00:00", "2024-06-30T13:00:00", "2024-06-30T12:00:00", "2024-12-31T17:00:00") // false (overlap)
 * @example intervalAbutsDateTime("invalid", "2024-06-30T12:00:00", "2024-06-30T12:00:00", "2024-12-31T17:00:00") // false
 */
export function intervalAbutsDateTime(
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
    !plainDateTime.test(aStart) ||
    !plainDateTime.test(aEnd) ||
    !plainDateTime.test(bStart) ||
    !plainDateTime.test(bEnd)
  ) {
    return false;
  }

  try {
    const aS = Temporal.PlainDateTime.from(aStart);
    const aE = Temporal.PlainDateTime.from(aEnd);
    const bS = Temporal.PlainDateTime.from(bStart);
    const bE = Temporal.PlainDateTime.from(bEnd);

    if (Temporal.PlainDateTime.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.PlainDateTime.compare(bS, bE) > 0) {
      return false;
    }

    return closedIntervalsAbut(
      aS,
      aE,
      bS,
      bE,
      Temporal.PlainDateTime.compare,
      (value) => value.subtract({ nanoseconds: 1 }),
    );
  } catch {
    return false;
  }
}
