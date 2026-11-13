// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { isTimeDurationUnitName } from "../../internal/unitNames";
import { plainTimeOf } from "../../internal/inputChecks";
import { readDurationUnits } from "../../internal";
import type { TimeDurationUnit } from "../../types";

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
    const time = plainTimeOf(value);
    const amounts = readDurationUnits(units, isTimeDurationUnitName);

    if (time === null || amounts === null) {
      return "";
    }

    try {
      return time.add(amounts).toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
