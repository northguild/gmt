import { zonedDateTimeFrom, zonedUnitStart } from "../../internal";
import type { Disambiguation, FractionalDigit, Offset } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the start of the quarter for a given zoned ISO datetime.
 *
 * - Calculates which quarter (1-4) the date falls into and returns the first instant of that quarter, with every field below the day reset — milliseconds, microseconds and nanoseconds included.
 * - Returns the real start of the local quarter in `value`'s own zone (see `floorToZone`), so the result is never after `value`: a skipped first midnight starts at the quarter's first real instant, and a repeated one (`Africa/Tunis`, 1978-10-01) at its first pass.
 * - `disambiguation` and `offset` are deprecated and ignored: a boundary is always a real instant, as TC39's `startOfDay()` takes neither.
 * - `fractionalSecondDigits` controls how many fractional seconds are included in the output: 0 (default — no fractional seconds), 3 (milliseconds), 6 (microseconds), or 9 (nanoseconds).
 * - Validation is performed on the input.
 *
 * @param value ISO ZonedDateTime string
 * @param optionsArg optional: fractionalSecondDigits (0 | 3 | 6 | 9, default 0), disambiguation and offset (deprecated, ignored)
 * @returns ISO ZonedDateTime string for the start of the quarter, or "" on invalid input
 *
 * @example startOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]") // "2024-01-01T00:00:00+00:00[UTC]"
 * @example startOfQuarterForZoned("2024-05-10T10:00:00+00:00[UTC]") // "2024-04-01T00:00:00+00:00[UTC]"
 * @example startOfQuarterForZoned("2024-11-20T08:00:00+00:00[UTC]") // "2024-10-01T00:00:00+00:00[UTC]"
 * @example startOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", { fractionalSecondDigits: 3 }) // "2024-01-01T00:00:00.000+00:00[UTC]"
 * @example startOfQuarterForZoned("1978-10-01T00:30:00+01:00[Africa/Tunis]", { disambiguation: "later" }) // "1978-10-01T00:00:00+02:00[Africa/Tunis]" (the quarter's first real instant; the deprecated option is ignored)
 * @example startOfQuarterForZoned("invalid") // ""
 */
export function startOfQuarterForZoned(
  value: string,
  optionsArg?: {
    /**
     * @deprecated Ignored. Boundaries are always real instants, matching TC39 `startOfDay()`, which takes no disambiguation or offset. Will be removed in the next major.
     */
    disambiguation?: Disambiguation;
    /**
     * @deprecated Ignored. Boundaries are always real instants, matching TC39 `startOfDay()`, which takes no disambiguation or offset. Will be removed in the next major.
     */
    offset?: Offset;
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits ?? 0;

  try {
    const start = zonedUnitStart(zonedDateTimeFrom(value), "quarter");
    return start ? start.toString({ fractionalSecondDigits }) : "";
  } catch {
    return "";
  }
}
