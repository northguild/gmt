import { zonedDateTimeFrom, zonedUnitStart } from "../../internal";
import type { FractionalDigit } from "../../types";
import { isValidZonedDateTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the start of the quarter for a given zoned ISO datetime.
 *
 * - Calculates which quarter (1-4) the date falls into and returns the first instant of that quarter, with every field below the day reset — milliseconds, microseconds and nanoseconds included.
 * - Returns the real start of the local quarter in `value`'s own zone (see `floorToZone`), so the result is never after `value`: a skipped first midnight starts at the quarter's first real instant, and a repeated one (`Africa/Tunis`, 1978-10-01) at its first pass.
 * - Validation is performed on the input.
 *
 * @param value ISO ZonedDateTime string
 * @param optionsArg optional setting for the precision of the output string
 * @returns ISO ZonedDateTime string for the start of the quarter, or "" on invalid input
 *
 * @example startOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]") // "2024-01-01T00:00:00+00:00[UTC]"
 * @example startOfQuarterForZoned("2024-05-10T10:00:00+00:00[UTC]") // "2024-04-01T00:00:00+00:00[UTC]"
 * @example startOfQuarterForZoned("2024-11-20T08:00:00+00:00[UTC]") // "2024-10-01T00:00:00+00:00[UTC]"
 * @example startOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", { fractionalSecondDigits: 3 }) // "2024-01-01T00:00:00.000+00:00[UTC]"
 * @example startOfQuarterForZoned("invalid") // ""
 */
export function startOfQuarterForZoned(
  value: string,
  optionsArg?: {
    /**
     * The number of fractional-second digits the result is written with, `0` to `9`, or `"auto"` to
     * drop trailing zeros. A start has no sub-second part, so any digits written are zeros.
     *
     * @defaultValue `0`
     */
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

    const fractionalSecondDigits =
      optionsArg?.fractionalSecondDigits === undefined
        ? 0
        : optionsArg.fractionalSecondDigits;

    try {
      const start = zonedUnitStart(zonedDateTimeFrom(value), "quarter");
      return start ? start.toString({ fractionalSecondDigits }) : "";
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
