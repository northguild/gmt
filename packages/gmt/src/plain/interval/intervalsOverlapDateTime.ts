import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../regex";

/**
 * Return true when intervals `[aStart, aEnd]` and `[bStart, bEnd]` share at least one instant.
 *
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Adjacent intervals (e.g. `aEnd === bStart`) do NOT overlap — returns `false`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 datetime string for the first interval start
 * @param aEnd ISO 8601 datetime string for the first interval end
 * @param bStart ISO 8601 datetime string for the second interval start
 * @param bEnd ISO 8601 datetime string for the second interval end
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapDateTime("2024-01-01T10:00:00", "2024-06-30T23:59:59", "2024-04-01T00:00:00", "2024-12-31T23:59:59") // true
 * @example intervalsOverlapDateTime("2024-01-01T10:00:00", "2024-06-30T23:59:59", "2024-07-01T00:00:00", "2024-12-31T23:59:59") // false (adjacent)
 * @example intervalsOverlapDateTime("2024-01-01T10:00:00", "2024-06-30T23:59:59", "2024-07-02T00:00:00", "2024-12-31T23:59:59") // false (disjoint)
 * @example intervalsOverlapDateTime("invalid", "2024-06-30T23:59:59", "2024-04-01T00:00:00", "2024-12-31T23:59:59") // false
 */
export function intervalsOverlapDateTime(
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

    return (
      Temporal.PlainDateTime.compare(aE, bS) >= 0 &&
      Temporal.PlainDateTime.compare(bE, aS) >= 0
    );
  } catch {
    return false;
  }
}
