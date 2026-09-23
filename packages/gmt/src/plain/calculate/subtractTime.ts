// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import type { TimeDurationUnit } from "../../types";
import { isValidTime, isValidTimeDurationUnit } from "../validate";

/**
 * Return a PlainTime ISO string with `units` subtracted from `value`.
 *
 * - Validates `value`, `units`, and `amount` before performing the subtract.
 * - Returns "" for invalid inputs.
 *
 * There is no options argument (its only member, `overflow`, was removed in 1.16.0): Temporal
 * `PlainTime#subtract` takes no options and always wraps around the clock (e.g. 01:00 - 2 hours
 * = 23:00).
 *
 * @param value ISO PlainTime string
 * @param units Partial<Record<TimeDurationUnit, number>> object specifying units to subtract
 * @returns ISO PlainTime string after subtraction, or "" on invalid input
 *
 * @example subtractTime("14:30:00", { hours: 1 }) // "13:30:00"
 * @example subtractTime("invalid", { hours: 1 }) // ""
 */
export function subtractTime(
  value: string,
  units: Partial<Record<TimeDurationUnit, number>>,
): string {
  try {
    const validTime = isValidTime(value);
    const validUnits =
      typeof units === "object" &&
      units !== null &&
      Object.keys(units).every(isValidTimeDurationUnit);
    const validAmounts = validUnits && Object.values(units).every(isValidAmount);

    if (!validTime || !validUnits || !validAmounts) {
      return "";
    }

    try {
      const time = Temporal.PlainTime.from(value);
      return time.subtract(units).toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
