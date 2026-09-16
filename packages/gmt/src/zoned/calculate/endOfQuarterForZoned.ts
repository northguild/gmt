import { zonedDateTimeFrom, zonedUnitEnd } from "../../internal";
import type { Disambiguation, FractionalDigit, Offset } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the end of the quarter for a given zoned ISO datetime.
 *
 * - Calculates which quarter (1-4) the date falls into and returns the last moment of that quarter.
 * - Returns one nanosecond before the next local quarter starts in `value`'s own zone (see `floorToZone`), so the result is never before `value`: a quarter whose last local hour repeats (`Africa/Cairo`, 2010-09-30) ends with the second pass.
 * - `disambiguation` and `offset` are deprecated and ignored: a boundary is always a real instant, as TC39's `startOfDay()` takes neither.
 * - The end is written at nanosecond precision by default, so the string names the end itself; an explicit `fractionalSecondDigits` (0, 3, 6 or 9) truncates it, as Temporal's `toString` does.
 * - Validation is performed on the input.
 * - **Compatibility:** before 1.16.0 the default printed no fractional digits, which wrote a moment
 *   earlier than the end. Pass `{ fractionalSecondDigits: 0 }` to keep the previous string.
 *
 * @param value ISO ZonedDateTime string
 * @param optionsArg optional: fractionalSecondDigits (0 | 3 | 6 | 9, default 9), disambiguation and offset (deprecated, ignored)
 * @returns ISO ZonedDateTime string for the end of the quarter, or "" on invalid input
 *
 * @example endOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]") // "2024-03-31T23:59:59.999999999+00:00[UTC]"
 * @example endOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", { fractionalSecondDigits: 0 }) // "2024-03-31T23:59:59+00:00[UTC]" — the pre-1.16.0 string
 * @example endOfQuarterForZoned("2024-05-10T10:00:00+00:00[UTC]") // "2024-06-30T23:59:59.999999999+00:00[UTC]"
 * @example endOfQuarterForZoned("2024-11-20T08:00:00+00:00[UTC]") // "2024-12-31T23:59:59.999999999+00:00[UTC]"
 * @example endOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", { fractionalSecondDigits: 3 }) // "2024-03-31T23:59:59.999+00:00[UTC]"
 * @example endOfQuarterForZoned("2010-09-30T23:30:00+02:00[Africa/Cairo]", { disambiguation: "compatible" }) // "2010-09-30T23:59:59.999999999+02:00[Africa/Cairo]" (the second pass of Q3's repeated last hour; the deprecated option is ignored)
 * @example endOfQuarterForZoned("invalid") // ""
 */
export function endOfQuarterForZoned(
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

  // An end is next start − 1 ns, so it defaults to nanosecond precision: fewer digits would
  // print an earlier instant than the end (Calendar & zone semantics §3).
  const fractionalSecondDigits = optionsArg?.fractionalSecondDigits ?? 9;

  try {
    const end = zonedUnitEnd(zonedDateTimeFrom(value), "quarter");
    return end ? end.toString({ fractionalSecondDigits }) : "";
  } catch {
    return "";
  }
}
