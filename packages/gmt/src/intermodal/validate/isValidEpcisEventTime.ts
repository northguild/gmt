import { Temporal } from "@js-temporal/polyfill";
import { epcisEventTime } from "../../regex";

/**
 * Return true when `value` is a real GS1 EPCIS 2.0 `eventTime`: the moment a supply-chain event
 * happened, written as a date and time with `Z` or a UTC offset.
 *
 * EPCIS (ISO/IEC 19987) is GS1's event standard for supply-chain visibility. This is the check
 * `isValidEpcisEvent` applies to the event's `eventTime` field: that validator calls this one.
 *
 * - The value must match `epcisEventTime`, the `DateTimeStamp` pattern of the EPCIS XSD:
 *   `YYYY-MM-DDTHH:MM:SS`, an optional fraction, then `Z` or a `±HH:MM` offset up to `14:00`.
 *   Seconds are required, `T` and `Z` are upper-case, and nothing may follow.
 * - Checks the calendar as well as the shape. The pattern proves the shape alone, so it matches
 *   a day the month does not have: `2024-02-30` and `2023-02-29` are false here.
 * - **GMT rule:** a fraction longer than nine digits is false, although the pattern matches a
 *   fraction of any length. An instant holds nanoseconds, and `parseEpcisEvent` does not drop
 *   digits.
 * - False for a leap second (`:60`), a space separator, an expanded year and a bracketed zone,
 *   none of which the pattern matches.
 * - An event also needs an `eventTimeZoneOffset`: check it with `isValidEpcisTimeZoneOffset`, or
 *   both fields with `isValidEpcisEvent`. Read an event with `parseEpcisEvent`.
 * - False for a non-string.
 *
 * @param value candidate EPCIS `eventTime` string
 * @returns boolean indicating validity
 *
 * @example isValidEpcisEventTime("2024-06-15T14:30:00Z") // true
 * @example isValidEpcisEventTime("2024-06-15T10:00:00.123+02:00") // true
 * @example isValidEpcisEventTime("2024-02-30T14:30:00Z") // false (30 February; the epcisEventTime pattern matches it)
 * @example isValidEpcisEventTime("2023-02-29T00:00:00Z") // false (2023 has no 29 February; the epcisEventTime pattern matches it)
 * @example isValidEpcisEventTime("2024-06-15T14:30:00.1234567891Z") // false (finer than a nanosecond; the epcisEventTime pattern matches it)
 * @example isValidEpcisEventTime("2024-06-15T14:30Z") // false (seconds are required)
 * @example isValidEpcisEventTime("2024-06-15T14:30:00") // false (Z or an offset is required)
 */
export function isValidEpcisEventTime(value: string): boolean {
  if (typeof value !== "string" || !epcisEventTime.test(value)) {
    return false;
  }

  try {
    // The two checks the pattern cannot make: a day the month does not have, and a fraction past
    // nine digits (Temporal's grammar stops at nanoseconds). Both are a RangeError.
    Temporal.Instant.from(value);
    return true;
  } catch {
    return false;
  }
}
