// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
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
 * Return a PlainDate ISO string with `amount` added according to `units`.
 *
 * - Validates `value`, `units`, and `amount` before performing the add.
 * - Accepts an RFC 9557 calendar-annotated PlainDate string (as `Temporal.PlainDate#toString()` and
 *   `convertDateToCalendar` write it, e.g. `"2024-02-24[u-ca=hebrew]"`), not just a bare ISO
 *   string. Calendar-unit arithmetic ("add 1 month") resolves against that calendar (a Hebrew leap
 *   month, a Persian leap year), and the result carries the same calendar annotation. A bare ISO
 *   string is the `"iso8601"` calendar and returns a bare ISO string.
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, `[u-ca=<id>]`, canonical
 *   calendar ids); see `isValidCalendarDate`.
 * - Whether `overflow: "reject"` returns "" is calendar-dependent: adding 1 year from Hebrew
 *   Adar I (a leap-only month) does not (Temporal remaps to the non-leap year's Adar instead of
 *   rejecting), while adding 1 month from the Ethiopic 30-day 12th month into the 5/6-day
 *   Pagumen does.
 * - Returns "" for invalid inputs.
 *
 * @param value ISO PlainDate string, optionally calendar-annotated
 * @param units Partial<Record<DateDurationUnit, number>> object specifying units to add
 * @param options How an out-of-range result is handled
 * @returns ISO PlainDate string after addition, or "" on invalid input
 *
 * @example addDate("2024-03-10", { days: 5 }) // "2024-03-15"
 * @example addDate("invalid", { days: 5 }) // ""
 * @example addDate("2024-01-31", { months: 1 }, { overflow: "constrain" }) // "2024-02-29"
 * @example addDate("2024-01-31", { months: 1 }, { overflow: "reject" }) // ""
 * @example addDate("2024-02-24[u-ca=hebrew]", { months: 1 }) // "2024-03-25[u-ca=hebrew]" (15 Adar I 5784 -> 15 Adar II)
 * @example addDate("2024-10-03[u-ca=japanese;era=reiwa]", { days: 1 }) // "" (not RFC 9557)
 */
export function addDate(
  value: string /* ISO 8601 date */,
  units: Partial<Record<DateDurationUnit, number>>,
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
        units,
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
