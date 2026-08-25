import { Temporal } from "@js-temporal/polyfill";
import { hasCalendarAnnotation } from "../../internal";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";

/**
 * Return the portion(s) of interval A not covered by interval B.
 *
 * - Uses `Temporal.Instant.compare` for comparison (via `.toInstant()`).
 * - Returns `[]` when B fully covers A.
 * - Returns `[{ start, end }]` when B overlaps one edge of A (or equals A).
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings, leap seconds).
 * - Rejects any `[u-ca=...]` calendar annotation (E5 issue #78, decision of record D2) —
 *   see `isValidZonedDateTime`'s JSDoc for why.
 *
 * @param aStart ISO 8601 zoned datetime string for the first interval start
 * @param aEnd ISO 8601 zoned datetime string for the first interval end
 * @param bStart ISO 8601 zoned datetime string for the second interval start
 * @param bEnd ISO 8601 zoned datetime string for the second interval end
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input
 *
 * @example intervalDifferenceZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-06-01T12:00:00+00:00[UTC]", "2024-07-01T13:00:00+00:00[UTC]") // [{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-05-31T17:00:00+00:00[UTC]" }, { start: "2024-07-01T13:00:01+00:00[UTC]", end: "2024-12-31T17:00:00+00:00[UTC]" }]
 * @example intervalDifferenceZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // []
 * @example intervalDifferenceZoned("invalid", "2024-12-31T17:00:00+00:00[UTC]", "2024-06-01T12:00:00+00:00[UTC]", "2024-07-01T13:00:00+00:00[UTC]") // []
 */
export function intervalDifferenceZoned(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): Array<{ start: string; end: string }> {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return [];
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
    return [];
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
      return [];
    }

    if (Temporal.Instant.compare(bS, bE) > 0) {
      return [];
    }

    const result: Array<{ start: string; end: string }> = [];

    // Left piece: A before B starts
    if (Temporal.Instant.compare(aS, bS) < 0) {
      const leftEnd =
        Temporal.Instant.compare(aE, bS) < 0
          ? aE
          : bS.subtract({ nanoseconds: 1 });
      if (Temporal.Instant.compare(leftEnd, aS) >= 0) {
        result.push({
          start: aSZdt.toString(),
          end: leftEnd.toZonedDateTimeISO(bEZdt.timeZoneId).toString(),
        });
      }
    }

    // Right piece: A after B ends
    if (Temporal.Instant.compare(aE, bE) > 0) {
      result.push({
        start: bE
          .add({ nanoseconds: 1 })
          .toZonedDateTimeISO(aEZdt.timeZoneId)
          .toString(),
        end: aEZdt.toString(),
      });
    }

    return result;
  } catch {
    return [];
  }
}
