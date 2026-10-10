import { isObject } from "../../internal";
import { isValidEpcisEventTime } from "./isValidEpcisEventTime";
import { isValidEpcisTimeZoneOffset } from "./isValidEpcisTimeZoneOffset";

/**
 * Validate whether a value carries the two required time fields of a GS1 EPCIS 2.0 event, each in
 * the grammar GS1 publishes for it.
 *
 * EPCIS (ISO/IEC 19987) is GS1's event standard for supply-chain visibility. True exactly when
 * `isValidEpcisEventTime` is true of `eventTime` and `isValidEpcisTimeZoneOffset` is true of
 * `eventTimeZoneOffset`: this validator calls the two, and no check needs both fields at once.
 * `parseEpcisEvent` returns a result for exactly the same values.
 *
 * - `eventTime` must match `epcisEventTime` (the `DateTimeStamp` pattern of the EPCIS XSD, the
 *   XML binding; the JSON schema says only `format: date-time`) and name a real instant: `YYYY-MM-DDTHH:MM:SS`, an optional fraction of up to nine digits, then
 *   `Z` or a `±HH:MM` offset. A day the month does not have (`2024-02-30`) is false, although the
 *   pattern matches it.
 * - `eventTimeZoneOffset` must match `epcisTimeZoneOffset` (the pattern the EPCIS JSON schema
 *   gives; the XSD types the field as a bare `xsd:string`): `±HH:MM` from `-14:00` to `+14:00`,
 *   the rule of EPCIS Standard Release 2.0 §7.4.1 (https://ref.gs1.org/standards/epcis/). A
 *   missing offset, `Z`, `+0200` and `+02` are false.
 * - The two fields are independent: an `eventTime` written with one offset and an
 *   `eventTimeZoneOffset` that is another is valid. EPCIS 2.0 §7.4.1.1 (non-normative): "there
 *   is no requirement that the time zone specifier in the XML representation of eventTime be the
 *   local time zone offset where the event was captured".
 * - **GMT rule:** a fraction longer than nine digits is false. The XSD allows any length; an
 *   instant holds nanoseconds, and `parseEpcisEvent` does not drop digits.
 * - Only the two fields are checked. `recordTime` and every other member are ignored, so this
 *   does not validate a whole event against the EPCIS schema.
 * - Returns false for a value that is not an object.
 *
 * @param event candidate EPCIS event, or any object with `eventTime` and `eventTimeZoneOffset`
 * @returns boolean indicating whether `parseEpcisEvent` reads the event, or false on invalid input
 *
 * @example isValidEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "-05:00" }) // true
 * @example isValidEpcisEvent({ eventTime: "2024-06-15T10:00:00+02:00", eventTimeZoneOffset: "-05:00" }) // true (the two offsets need not agree)
 * @example isValidEpcisEvent({ eventTime: "2024-06-15T14:30:00.123456789Z", eventTimeZoneOffset: "+14:00" }) // true
 * @example isValidEpcisEvent({ eventTime: "2024-06-15T14:30:00Z" }) // false (eventTimeZoneOffset is required)
 * @example isValidEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "Z" }) // false (a designator, not an offset)
 * @example isValidEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "+0200" }) // false (no colon)
 * @example isValidEpcisEvent({ eventTime: "2024-06-15T14:30Z", eventTimeZoneOffset: "-05:00" }) // false (seconds are required)
 * @example isValidEpcisEvent({ eventTime: "2024-02-30T14:30:00Z", eventTimeZoneOffset: "-05:00" }) // false (30 February)
 * @example isValidEpcisEvent("2024-06-15T14:30:00Z") // false (not an event)
 */
export function isValidEpcisEvent(event: unknown): boolean {
  try {
    if (!isObject(event)) {
      return false;
    }

    // Each field is read once, in the order `parseEpcisEvent` reads them.
    const { eventTime, eventTimeZoneOffset } = event as Record<string, unknown>;

    return (
      isValidEpcisEventTime(eventTime as string) &&
      isValidEpcisTimeZoneOffset(eventTimeZoneOffset as string)
    );
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return false;
  }
}
