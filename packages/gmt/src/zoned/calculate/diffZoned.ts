import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain/validate";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the difference between two zoned datetimes measured in the given
 * date-time `unit` (year|month|day|hour|minute|...).
 *
 * - Uses Temporal.ZonedDateTime.until with `largestUnit` and extracts the
 *   requested unit from the resulting Duration.
 * - Returns `null` for invalid inputs.
 *
 * @param value1 zoned ISO 8601 datetime string (start)
 * @param value2 zoned ISO 8601 datetime string (end)
 * @param unit Temporal.DateTimeUnit
 * @returns numeric difference in the requested unit, or null on invalid input
 */
export function diffZoned(
  value1: string,
  value2: string,
  unit: Temporal.DateTimeUnit,
): number | null {
  if (
    !isValidZonedDateTime(value1) ||
    !isValidZonedDateTime(value2) ||
    !isValidDateTimeUnit(unit)
  ) {
    return null;
  }

  try {
    const normalizedZdt1 =
      Temporal.ZonedDateTime.from(value1).withTimeZone("UTC");
    const normalizedZdt2 =
      Temporal.ZonedDateTime.from(value2).withTimeZone("UTC");

    const duration = normalizedZdt1.until(normalizedZdt2, {
      largestUnit: unit,
    });

    return duration[`${unit}s`] ?? null;
  } catch {
    return null;
  }
}
