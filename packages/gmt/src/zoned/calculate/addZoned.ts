import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Add a temporal amount to a zoned ISO 8601 datetime string and return a zoned ISO 8601 string.
 *
 * - Uses Temporal.ZonedDateTime.add to add duration.
 * - Validates duration units and values.
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 zoned datetime string
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to add
 * @returns zoned ISO 8601 string on success, or "" on invalid input
 *
 * @example addZoned("2024-02-29T14:30:45.123-05:00[America/New_York]", { days: 1 }) // "2024-03-01T14:30:45.123-05:00[America/New_York]"
 * @example addZoned("invalid", { days: 1 }) // ""
 */
export function addZoned(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
): string {
  const validZonedDateTime = isValidZonedDateTime(value);
  const validUnits = Object.keys(units).every(isValidDateTimeDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validZonedDateTime || !validUnits || !validAmounts) {
    // TODO descriptive messages of what failed - likely could be GMT offset for historical changes and DST
    return "";
  }

  try {
    const zoned = Temporal.ZonedDateTime.from(value);
    return zoned.add(units).toString();
  } catch {
    return "";
  }
}
