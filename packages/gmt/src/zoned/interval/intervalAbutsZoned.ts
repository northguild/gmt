import { Temporal } from "@js-temporal/polyfill";
import { hasCalendarAnnotation } from "../../internal";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";

/**
 * Return true when two zoned intervals are exactly adjacent — one's end equals the other's
 * start with zero gap and zero overlap.
 *
 * - Uses `Temporal.Instant.compare` for comparison (via `.toInstant()`).
 * - Returns `true` when `aEnd + 1 nanosecond === bStart` or `bEnd + 1 nanosecond === aStart`.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 * - Rejects any `[u-ca=...]` calendar annotation (E5 issue #78, decision of record D2) —
 *   see `isValidZonedDateTime`'s JSDoc for why.
 *
 * @param aStart ISO 8601 zoned datetime string for the first interval start
 * @param aEnd ISO 8601 zoned datetime string for the first interval end
 * @param bStart ISO 8601 zoned datetime string for the second interval start
 * @param bEnd ISO 8601 zoned datetime string for the second interval end
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-06-30T12:00:00.000000001+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // true
 * @example intervalAbutsZoned("2024-06-30T12:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00.000000001+00:00[UTC]") // true
 * @example intervalAbutsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-06-30T12:00:01+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // false (gap)
 * @example intervalAbutsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T13:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // false (overlap)
 * @example intervalAbutsZoned("invalid", "2024-06-30T12:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // false
 */
export function intervalAbutsZoned(
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
    isLeapSecond(aStart) ||
    isLeapSecond(aEnd) ||
    isLeapSecond(bStart) ||
    isLeapSecond(bEnd) ||
    hasCalendarAnnotation(aStart) ||
    hasCalendarAnnotation(aEnd) ||
    hasCalendarAnnotation(bStart) ||
    hasCalendarAnnotation(bEnd)
  ) {
    return false;
  }

  try {
    const aSZdt = Temporal.ZonedDateTime.from(aStart);
    const aEZdt = Temporal.ZonedDateTime.from(aEnd);
    const bSZdt = Temporal.ZonedDateTime.from(bStart);
    const bEZdt = Temporal.ZonedDateTime.from(bEnd);

    const aS = aSZdt.toInstant();
    const aE = aEZdt.toInstant();
    const bS = bSZdt.toInstant();
    const bE = bEZdt.toInstant();

    if (Temporal.Instant.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.Instant.compare(bS, bE) > 0) {
      return false;
    }

    // aEnd + 1 nanosecond === bStart
    const aEndPlusOne = aE.add({ nanoseconds: 1 });
    if (Temporal.Instant.compare(aEndPlusOne, bS) === 0) {
      return true;
    }

    // bEnd + 1 nanosecond === aStart
    const bEndPlusOne = bE.add({ nanoseconds: 1 });
    if (Temporal.Instant.compare(bEndPlusOne, aS) === 0) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
