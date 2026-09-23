import { zonedDateTimeFrom, zonedUnitEnd } from "../../internal";
import type { FractionalDigit } from "../../types";
import { isValidZonedDateTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the end of the quarter for a given zoned ISO datetime.
 *
 * - Calculates which quarter (1-4) the date falls into and returns the last moment of that quarter.
 * - Returns one nanosecond before the next local quarter starts in `value`'s own zone (see `floorToZone`), so the result is never before `value`: a quarter whose last local hour repeats (`Africa/Cairo`, 2010-09-30) ends with the second pass.
 * - The end is written at nanosecond precision by default, so the string names the end itself; an explicit `fractionalSecondDigits` (0, 3, 6 or 9) truncates it, as Temporal's `toString` does.
 * - Validation is performed on the input.
 * - **Compatibility:** before 1.16.0 the default printed no fractional digits, which wrote a moment
 *   earlier than the end. Pass `{ fractionalSecondDigits: 0 }` to keep the previous string.
 *
 * @param value ISO ZonedDateTime string
 * @param optionsArg optional: fractionalSecondDigits (0 | 3 | 6 | 9, default 9)
 * @returns ISO ZonedDateTime string for the end of the quarter, or "" on invalid input
 *
 * @example endOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]") // "2024-03-31T23:59:59.999999999+00:00[UTC]"
 * @example endOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", { fractionalSecondDigits: 0 }) // "2024-03-31T23:59:59+00:00[UTC]" — the pre-1.16.0 string
 * @example endOfQuarterForZoned("2024-05-10T10:00:00+00:00[UTC]") // "2024-06-30T23:59:59.999999999+00:00[UTC]"
 * @example endOfQuarterForZoned("2024-11-20T08:00:00+00:00[UTC]") // "2024-12-31T23:59:59.999999999+00:00[UTC]"
 * @example endOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", { fractionalSecondDigits: 3 }) // "2024-03-31T23:59:59.999+00:00[UTC]"
 * @example endOfQuarterForZoned("invalid") // ""
 */
export function endOfQuarterForZoned(
  value: string,
  optionsArg?: {
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  try {
    if (!isOptionsArgument(optionsArg)) {
      return "";
    }

    if (!isValidZonedDateTime(value)) {
      return "";
    }

    // An end is next start − 1 ns, so it defaults to nanosecond precision: fewer digits would
    // print an earlier instant than the end (Calendar & zone semantics §3).
    const fractionalSecondDigits =
      optionsArg?.fractionalSecondDigits === undefined
        ? 9
        : optionsArg.fractionalSecondDigits;

    try {
      const end = zonedUnitEnd(zonedDateTimeFrom(value), "quarter");
      return end ? end.toString({ fractionalSecondDigits }) : "";
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
