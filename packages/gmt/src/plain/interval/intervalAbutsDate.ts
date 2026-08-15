import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";

/**
 * Return true when two date intervals are exactly adjacent — one's end equals the other's start
 * with zero gap and zero overlap.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Returns `true` when `aEnd + 1 day === bStart` or `bEnd + 1 day === aStart`.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 date string for the first interval start
 * @param aEnd ISO 8601 date string for the first interval end
 * @param bStart ISO 8601 date string for the second interval start
 * @param bEnd ISO 8601 date string for the second interval end
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31") // true
 * @example intervalAbutsDate("2024-07-01", "2024-12-31", "2024-01-01", "2024-06-30") // true
 * @example intervalAbutsDate("2024-01-01", "2024-06-30", "2024-07-02", "2024-12-31") // false (gap)
 * @example intervalAbutsDate("2024-01-01", "2024-07-01", "2024-06-30", "2024-12-31") // false (overlap)
 * @example intervalAbutsDate("invalid", "2024-06-30", "2024-07-01", "2024-12-31") // false
 */
export function intervalAbutsDate(
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

    // aEnd + 1 day === bStart
    const aEndPlusOne = aE.add({ days: 1 });
    if (Temporal.PlainDate.compare(aEndPlusOne, bS) === 0) {
      return true;
    }

    // bEnd + 1 day === aStart
    const bEndPlusOne = bE.add({ days: 1 });
    if (Temporal.PlainDate.compare(bEndPlusOne, aS) === 0) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
