// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount, resolveOverflow } from "../../internal";
import type { DateTimeDurationUnit, Overflow } from "../../types";
import { isValidDateTime, isValidDateTimeDurationUnit } from "../validate";
import { isObject, isOptionsArgument } from "../../internal/isObject";

/**
 * Return a PlainDateTime ISO string with `units` added to `value`.
 *
 * - Validates `value`, `units`, and `amount` before performing the add.
 * - Returns "" for invalid inputs.
 *
 * @param value ISO PlainDateTime string
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to add
 * @param options How an out-of-range result is handled
 * @returns ISO PlainDateTime string after addition, or "" on invalid input
 *
 * @example addDateTime("2024-03-10T12:00:00", { days: 5 }) // "2024-03-15T12:00:00"
 * @example addDateTime("invalid", { days: 5 }) // ""
 * @example addDateTime("2024-01-31T12:00:00", { months: 1 }, { overflow: "reject" }) // ""
 */
export function addDateTime(
  value: string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
  options?: {
    /**
     * What to do when the result is not a real date. `"constrain"` clamps it to the last valid day,
     * so Jan 31 + 1 month is Feb 29 or 28; `"reject"` returns `""`.
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

    const validDateTime = isValidDateTime(value);
    const validUnits =
      isObject(units) && Object.keys(units).every(isValidDateTimeDurationUnit);
    const validAmounts =
      validUnits && Object.values(units).every(isValidAmount);

    if (!validDateTime || !validUnits || !validAmounts) {
      return "";
    }

    try {
      const dateTime = Temporal.PlainDateTime.from(value);
      return dateTime
        .add(units, { overflow: resolveOverflow(options?.overflow) })
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
