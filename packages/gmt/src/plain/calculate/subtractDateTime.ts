// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount, resolveOverflow } from "../../internal";
import type { DateTimeDurationUnit, Overflow } from "../../types";
import { isValidDateTime, isValidDateTimeDurationUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return a PlainDateTime ISO string with `units` subtracted from `value`.
 *
 * - Validates `value`, `units`, and `amount` before performing the subtract.
 * - Returns "" for invalid inputs.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. subtracting
 * 1 month from Mar 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in "").
 *
 * @param value ISO PlainDateTime string
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to subtract
 * @param options optional: overflow ("constrain" | "reject")
 * @returns ISO PlainDateTime string after subtraction, or "" on invalid input
 *
 * @example subtractDateTime("2024-03-15T12:00:00", { days: 5 }) // "2024-03-10T12:00:00"
 * @example subtractDateTime("invalid", { days: 5 }) // ""
 * @example subtractDateTime("2024-03-31T12:00:00", { months: 1 }, { overflow: "reject" }) // ""
 */
export function subtractDateTime(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
  options?: { overflow?: Overflow },
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

    const validDateTime = isValidDateTime(value);
    const validUnits =
      typeof units === "object" &&
      units !== null &&
      Object.keys(units).every(isValidDateTimeDurationUnit);
    const validAmounts = validUnits && Object.values(units).every(isValidAmount);

    if (!validDateTime || !validUnits || !validAmounts) {
      return "";
    }

    try {
      const dateTime = Temporal.PlainDateTime.from(value);
      return dateTime
        .subtract(units, { overflow: resolveOverflow(options?.overflow) })
        .toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
