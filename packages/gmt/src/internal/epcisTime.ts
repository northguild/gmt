import { epcisEventTime, epcisTimeZoneOffset } from "../regex";
import { Temporal } from "./temporal";
import { parseUtcOffsetNanoseconds } from "./utcOffsetString";

/**
 * The check behind `isValidEpcisEventTime`: an EPCIS `eventTime`, an ISO 8601 instant with an
 * explicit offset.
 *
 * @param value the candidate; a value that is not a string is not an event time
 * @returns whether it is a real event time
 *
 * @example isEpcisEventTime("2024-03-15T12:30:45.123Z") // true
 * @example isEpcisEventTime("2024-02-30T12:30:45Z") // false
 */
export function isEpcisEventTime(value: unknown): boolean {
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

/**
 * The check behind `isValidEpcisTimeZoneOffset`: an EPCIS `eventTimeZoneOffset`, `+HH:MM` or
 * `-HH:MM`.
 *
 * @param value the candidate; a value that is not a string is not an offset
 * @returns whether it is a real EPCIS offset
 *
 * @example isEpcisTimeZoneOffset("+05:30") // true
 * @example isEpcisTimeZoneOffset("+24:00") // false
 */
export function isEpcisTimeZoneOffset(value: unknown): boolean {
  // `parseEpcisEvent` reads the offset through Temporal after the pattern, so this does too. No
  // string the pattern matches fails that read: it is here so the two cannot drift.
  return (
    typeof value === "string" &&
    epcisTimeZoneOffset.test(value) &&
    parseUtcOffsetNanoseconds(value) !== null
  );
}
