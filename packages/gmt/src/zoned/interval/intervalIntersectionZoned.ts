import { Temporal } from "@js-temporal/polyfill";
import { hasCalendarAnnotation } from "../../internal";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";

/**
 * Return the overlapping span of two zoned intervals, or null when they do not overlap.
 *
 * - Uses `Temporal.ZonedDateTime.compare` for comparison (same instant semantics).
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one instant and DO overlap.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings, leap seconds).
 * - Rejects any `[u-ca=...]` calendar annotation (E5 issue #78, decision of record D2) —
 *   see `isValidZonedDateTime`'s JSDoc for why.
 *
 * @param aStart ISO 8601 zoned datetime string for the first interval start
 * @param aEnd ISO 8601 zoned datetime string for the first interval end
 * @param bStart ISO 8601 zoned datetime string for the second interval start
 * @param bEnd ISO 8601 zoned datetime string for the second interval end
 * @returns `{ start, end }` with the overlapping span, or null on invalid input / no overlap
 *
 * @example intervalIntersectionZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // { start: "2024-04-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:59+00:00[UTC]" }
 * @example intervalIntersectionZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-07-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // null
 * @example intervalIntersectionZoned("invalid", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // null
 */
export function intervalIntersectionZoned(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): { start: string; end: string } | null {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return null;
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
    return null;
  }

  try {
    const aZdt = Temporal.ZonedDateTime.from(aStart);
    const aZde = Temporal.ZonedDateTime.from(aEnd);
    const bZdt = Temporal.ZonedDateTime.from(bStart);
    const bZde = Temporal.ZonedDateTime.from(bEnd);

    if (Temporal.ZonedDateTime.compare(aZdt, aZde) > 0) {
      return null;
    }

    if (Temporal.ZonedDateTime.compare(bZdt, bZde) > 0) {
      return null;
    }

    if (
      Temporal.ZonedDateTime.compare(aZde, bZdt) < 0 ||
      Temporal.ZonedDateTime.compare(bZde, aZdt) < 0
    ) {
      return null;
    }

    const start = Temporal.ZonedDateTime.compare(aZdt, bZdt) >= 0 ? aZdt : bZdt;
    const end = Temporal.ZonedDateTime.compare(aZde, bZde) <= 0 ? aZde : bZde;

    return { start: start.toString(), end: end.toString() };
  } catch {
    return null;
  }
}
