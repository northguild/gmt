import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";

/**
 * Return true when interval B is fully contained within interval A — every instant of B
 * falls within A.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Equivalent to 4-argument `intervalContainsDate(aStart, aEnd, bStart, bEnd)`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 date string for the outer interval start
 * @param aEnd ISO 8601 date string for the outer interval end
 * @param bStart ISO 8601 date string for the inner interval start
 * @param bEnd ISO 8601 date string for the inner interval end
 * @returns true if B is fully contained in A, or false on invalid input
 *
 * @example intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01") // true
 * @example intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31") // true (equal intervals)
 * @example intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-12-31") // true
 * @example intervalEngulfsDate("2024-06-01", "2024-07-01", "2024-01-01", "2024-12-31") // false
 * @example intervalEngulfsDate("invalid", "2024-12-31", "2024-06-01", "2024-07-01") // false
 */
export function intervalEngulfsDate(
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
      Temporal.PlainDate.compare(aS, bS) <= 0 &&
      Temporal.PlainDate.compare(bE, aE) <= 0
    );
  } catch {
    return false;
  }
}
