import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../regex";

/**
 * Return true when interval B is fully contained within interval A — every instant of B
 * falls within A.
 *
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Equivalent to 4-argument `intervalContainsDateTime(aStart, aEnd, bStart, bEnd)`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 datetime string for the outer interval start
 * @param aEnd ISO 8601 datetime string for the outer interval end
 * @param bStart ISO 8601 datetime string for the inner interval start
 * @param bEnd ISO 8601 datetime string for the inner interval end
 * @returns true if B is fully contained in A, or false on invalid input
 *
 * @example intervalEngulfsDateTime("2024-01-01T09:00:00", "2024-12-31T17:00:00", "2024-06-01T12:00:00", "2024-07-01T13:00:00") // true
 * @example intervalEngulfsDateTime("2024-01-01T09:00:00", "2024-12-31T17:00:00", "2024-01-01T09:00:00", "2024-12-31T17:00:00") // true (equal intervals)
 * @example intervalEngulfsDateTime("2024-01-01T09:00:00", "2024-12-31T17:00:00", "2024-01-01T09:00:00", "2024-06-30T12:00:00") // true
 * @example intervalEngulfsDateTime("2024-06-01T12:00:00", "2024-07-01T13:00:00", "2024-01-01T09:00:00", "2024-12-31T17:00:00") // false
 * @example intervalEngulfsDateTime("invalid", "2024-12-31T17:00:00", "2024-06-01T12:00:00", "2024-07-01T13:00:00") // false
 */
export function intervalEngulfsDateTime(
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
      Temporal.PlainDateTime.compare(aS, bS) <= 0 &&
      Temporal.PlainDateTime.compare(bE, aE) <= 0
    );
  } catch {
    return false;
  }
}
