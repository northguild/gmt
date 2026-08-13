import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";

/**
 * Return the combined span of two zoned intervals, or null when they are disjoint.
 *
 * - Uses `Temporal.ZonedDateTime.compare` for comparison (same instant semantics).
 * - Overlapping intervals return their merged span.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one instant and ARE merged.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 zoned datetime string for the first interval start
 * @param aEnd ISO 8601 zoned datetime string for the first interval end
 * @param bStart ISO 8601 zoned datetime string for the second interval start
 * @param bEnd ISO 8601 zoned datetime string for the second interval end
 * @returns `{ start, end }` with the merged span, or null on invalid input / disjoint intervals
 *
 * @example intervalUnionZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // { start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-12-31T23:59:59+00:00[UTC]" }
 * @example intervalUnionZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // { start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-12-31T23:59:59+00:00[UTC]" }
 * @example intervalUnionZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-06-30T23:59:59+00:00[UTC]", "2024-07-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // null
 * @example intervalUnionZoned("invalid", "2024-06-30T23:59:59+00:00[UTC]", "2024-04-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // null
 */
export function intervalUnionZoned(
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
    isLeapSecond(bEnd)
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

    const start = Temporal.ZonedDateTime.compare(aZdt, bZdt) <= 0 ? aZdt : bZdt;
    const end = Temporal.ZonedDateTime.compare(aZde, bZde) >= 0 ? aZde : bZde;

    return { start: start.toString(), end: end.toString() };
  } catch {
    return null;
  }
}
