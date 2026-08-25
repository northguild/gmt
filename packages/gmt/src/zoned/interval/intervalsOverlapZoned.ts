import { Temporal } from "@js-temporal/polyfill";
import { hasCalendarAnnotation } from "../../internal";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";

/**
 * Return true when intervals `[aStart, aEnd]` and `[bStart, bEnd]` share at least one instant.
 *
 * - Uses `Temporal.Instant.compare` for comparison (same instant semantics).
 * - Adjacent intervals (e.g. `aEnd === bStart`) do NOT overlap — returns `false`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 * - Rejects any `[u-ca=...]` calendar annotation (E5 issue #78, decision of record D2) —
 *   see `isValidZonedDateTime`'s JSDoc for why.
 *
 * @param aStart ISO 8601 zoned datetime string for the first interval start
 * @param aEnd ISO 8601 zoned datetime string for the first interval end
 * @param bStart ISO 8601 zoned datetime string for the second interval start
 * @param bEnd ISO 8601 zoned datetime string for the second interval end
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // true
 * @example intervalsOverlapZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-07-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // false (adjacent)
 * @example intervalsOverlapZoned("invalid", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // false
 */
export function intervalsOverlapZoned(
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
    const aZdt = Temporal.ZonedDateTime.from(aStart);
    const aZde = Temporal.ZonedDateTime.from(aEnd);
    const bZdt = Temporal.ZonedDateTime.from(bStart);
    const bZde = Temporal.ZonedDateTime.from(bEnd);

    const aSI = aZdt.toInstant();
    const aEI = aZde.toInstant();
    const bSI = bZdt.toInstant();
    const bEI = bZde.toInstant();

    if (Temporal.Instant.compare(aSI, aEI) > 0) {
      return false;
    }

    if (Temporal.Instant.compare(bSI, bEI) > 0) {
      return false;
    }

    return (
      Temporal.Instant.compare(aEI, bSI) >= 0 &&
      Temporal.Instant.compare(bEI, aSI) >= 0
    );
  } catch {
    return false;
  }
}
