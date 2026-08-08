import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount, resolveOverflow } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, Overflow } from "../../types";
import { isValidUtc } from "../validate";

/**
 * Subtract a temporal amount from a UTC datetime string and return a new UTC Instant string.
 *
 * - Uses Temporal.Instant.from to parse, subtracts duration, returns new Instant.
 * - Validates duration units and values.
 * - Returns "" for invalid input.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. subtracting
 * 1 month from Mar 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in "").
 *
 * @param value ISO UTC datetime string (e.g. "2024-03-10T12:00:00Z")
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to subtract
 * @param options optional: overflow ("constrain" | "reject")
 * @returns UTC Instant string after subtraction, or "" on invalid input
 *
 * @example subtractUtc("2024-03-15T12:00:00Z", { days: 5 }) // "2024-03-10T12:00:00Z"
 * @example subtractUtc("2024-03-15T12:00:00Z", { months: 1, years: 1 }) // "2023-02-15T12:00:00Z"
 * @example subtractUtc("invalid", { days: 5 }) // ""
 */
export function subtractUtc(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
  options?: { overflow?: Overflow },
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
    const result = zoned.subtract(units, {
      overflow: resolveOverflow(options?.overflow),
    });
    return result.toInstant().toString();
  } catch {
    return "";
  }
}
