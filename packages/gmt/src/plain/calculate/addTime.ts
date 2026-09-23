// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import type { TimeDurationUnit } from "../../types";
import { isValidTime, isValidTimeDurationUnit } from "../validate";

/**
 * Return a PlainTime ISO string with `units` added to `value`.
 *
 * - Validates `value`, `units`, and `amount` before performing the add.
 * - Returns "" for invalid inputs.
 *
 * There is no options argument (its only member, `overflow`, was removed in 1.16.0): Temporal
 * `PlainTime#add` takes no options and always wraps around the clock (e.g. 23:00 + 2 hours
 * = 01:00).
 *
 * @param value ISO PlainTime string
 * @param units Partial<Record<TimeDurationUnit, number>> object specifying units to add
 * @returns ISO PlainTime string after addition, or "" on invalid input
 *
 * @example addTime("12:00:00", { hours: 1 }) // "13:00:00"
 * @example addTime("invalid", { hours: 1 }) // ""
 */
export function addTime(
  value: string,
  units: Partial<Record<TimeDurationUnit, number>>,
): string {
  try {
    const validTime = isValidTime(value);
    const validUnits =
      typeof units === "object" &&
      units !== null &&
      Object.keys(units).every(isValidTimeDurationUnit);
    const validAmounts =
      validUnits && Object.values(units).every(isValidAmount);

    if (!validTime || !validUnits || !validAmounts) {
      return "";
    }

    try {
      const time = Temporal.PlainTime.from(value);
      return time.add(units).toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
