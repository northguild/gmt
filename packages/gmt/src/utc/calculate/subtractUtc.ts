import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit } from "../../types";
import { isValidUtc } from "../validate";

/**
 * Subtract a temporal amount from a UTC datetime string and return a new UTC Instant string.
 *
 * - Uses Temporal.Instant.from to parse, subtracts duration, returns new Instant.
 * - Validates duration units and values.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g. "2024-03-10T12:00:00Z")
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to subtract
 * @returns UTC Instant string after subtraction, or "" on invalid input
 *
 * @example subtractUtc("2024-03-15T12:00:00Z", { days: 5 }) // "2024-03-10T12:00:00Z"
 * @example subtractUtc("2024-03-15T12:00:00Z", { months: 1, years: 1 }) // "2023-02-15T12:00:00Z"
 * @example subtractUtc("invalid", { days: 5 }) // ""
 */
export function subtractUtc(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
): string {
  const validUtc = isValidUtc(value);
  const validUnits = Object.keys(units).every(isValidDateTimeDurationUnit);
  const validAmounts = Object.values(units).every(isValidAmount);

  if (!validUtc || !validUnits || !validAmounts) {
    return "";
  }

  try {
    const instant = Temporal.Instant.from(value);
    const zoned = instant.toZonedDateTimeISO("UTC");
    const result = zoned.subtract(units);
    return result.toInstant().toString();
  } catch {
    return "";
  }
}
