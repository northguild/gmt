import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";

/**
 * Return true when intervals `[aStart, aEnd]` and `[bStart, bEnd]` share at least one instant.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Adjacent intervals (e.g. `aEnd === bStart`) do NOT overlap — returns `false`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 date string for the first interval start
 * @param aEnd ISO 8601 date string for the first interval end
 * @param bStart ISO 8601 date string for the second interval start
 * @param bEnd ISO 8601 date string for the second interval end
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31") // true
 * @example intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31") // false (adjacent)
 * @example intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-07-02", "2024-12-31") // false (disjoint)
 * @example intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-02-01", "2024-03-01") // true (partial)
 * @example intervalsOverlapDate("invalid", "2024-06-30", "2024-04-01", "2024-12-31") // false
 */
export function intervalsOverlapDate(
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
    !plainDate.test(aStart) ||
    !plainDate.test(aEnd) ||
    !plainDate.test(bStart) ||
    !plainDate.test(bEnd)
  ) {
    return false;
  }

  try {
    const aS = Temporal.PlainDate.from(aStart);
    const aE = Temporal.PlainDate.from(aEnd);
    const bS = Temporal.PlainDate.from(bStart);
    const bE = Temporal.PlainDate.from(bEnd);

    if (Temporal.PlainDate.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.PlainDate.compare(bS, bE) > 0) {
      return false;
    }

    return (
      Temporal.PlainDate.compare(aE, bS) >= 0 &&
      Temporal.PlainDate.compare(bE, aS) >= 0
    );
  } catch {
    return false;
  }
}
