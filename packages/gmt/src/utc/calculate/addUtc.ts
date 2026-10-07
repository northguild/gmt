// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount, resolveOverflow } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, Overflow } from "../../types";
import { isValidUtc } from "../validate/isValidUtc";
import { isObject, isOptionsArgument } from "../../internal/isObject";

/**
 * Add a temporal amount to a UTC datetime string and return a new UTC Instant string.
 *
 * - Uses Temporal.Instant.from to parse, adds duration, returns new Instant.
 * - Validates duration units and values.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g. "2024-03-10T12:00:00Z")
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to add
 * @param options How an out-of-range result is handled
 * @returns UTC Instant string after addition, or "" on invalid input
 *
 * @example addUtc("2024-03-10T12:00:00Z", { days: 5 }) // "2024-03-15T12:00:00Z"
 * @example addUtc("2024-03-10T12:00:00Z", { months: 1, years: 1 }) // "2025-04-10T12:00:00Z"
 * @example addUtc("invalid", { days: 5 }) // ""
 */
export function addUtc(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
  options?: {
    /**
     * What to do when the result is not a real date. `"constrain"` clamps it to the last valid day,
     * so Jan 31 + 1 month is Feb 29/28 (TC39 Temporal); `"reject"` returns `""`.
     *
     * @defaultValue `"constrain"`, Temporal's default.
     */
    overflow?: Overflow;
  },
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

    const validUtc = isValidUtc(value);
    const validUnits =
      isObject(units) && Object.keys(units).every(isValidDateTimeDurationUnit);
    const validAmounts =
      validUnits && Object.values(units).every(isValidAmount);

    if (!validUtc || !validUnits || !validAmounts) {
      return "";
    }

    try {
      const instant = Temporal.Instant.from(value);
      const zoned = instant.toZonedDateTimeISO("UTC");
      const result = zoned.add(units, {
        overflow: resolveOverflow(options?.overflow),
      });
      return result.toInstant().toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
