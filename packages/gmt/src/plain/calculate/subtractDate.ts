// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import {
  calendarSystemOfDateValue,
  formatDateInCalendar,
  isValidAmount,
  parseCalendarDateValue,
  plainDateAdd,
  resolveOverflow,
} from "../../internal";
import type { DateDurationUnit, Overflow } from "../../types";
import { isValidCalendarDate, isValidDateDurationUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return a PlainDate ISO string with `units` subtracted from `value`.
 *
 * - Validates `value`, `units`, and `amount` before performing the subtract.
 * - Accepts an RFC 9557 calendar-annotated PlainDate string (as `convertDateToCalendar` writes it),
 *   not just a bare ISO string. See `addDate`'s JSDoc for the calendar-unit arithmetic (leap
 *   months and years, the `overflow` asymmetry); this function is the mirror image.
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, `[u-ca=<id>]`, canonical
 *   calendar ids); see `isValidCalendarDate`.
 * - Returns "" for invalid inputs.
 *
 * `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. subtracting
 * 1 month from Mar 31: "constrain" clamps to Feb 29/28, "reject" throws (resulting in "").
 *
 * @param value ISO PlainDate string, optionally calendar-annotated
 * @param units Partial<Record<DateDurationUnit, number>> object specifying units to subtract
 * @param options optional: overflow ("constrain" | "reject")
 * @returns ISO PlainDate string after subtraction, or "" on invalid input
 *
 * @example subtractDate("2024-03-15", { days: 5 }) // "2024-03-10"
 * @example subtractDate("invalid", { days: 5 }) // ""
 * @example subtractDate("2024-03-31", { months: 1 }, { overflow: "reject" }) // ""
 * @example subtractDate("2024-03-25[u-ca=hebrew]", { months: 1 }) // "2024-02-24[u-ca=hebrew]" (15 Adar II 5784 -> 15 Adar I)
 */
export function subtractDate(
  value: string,
  units: Partial<Record<DateDurationUnit, number>>,
  options?: { overflow?: Overflow },
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

    const validDate = isValidCalendarDate(value);
    const validUnits =
      typeof units === "object" &&
      units !== null &&
      Object.keys(units).every(isValidDateDurationUnit);
    const validAmounts =
      validUnits && Object.values(units).every(isValidAmount);

    if (!validDate || !validUnits || !validAmounts) {
      return "";
    }

    try {
      const calendar = calendarSystemOfDateValue(value);
      if (!calendar) {
        return "";
      }
      const date = parseCalendarDateValue(value);
      const result = plainDateAdd(
        date,
        Temporal.Duration.from(units).negated(),
        resolveOverflow(options?.overflow),
      );
      return formatDateInCalendar(result, calendar);
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
