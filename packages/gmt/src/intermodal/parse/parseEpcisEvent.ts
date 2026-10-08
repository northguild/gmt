import { Temporal } from "@js-temporal/polyfill";
import {
  formatUtcOffset,
  isObject,
  parseUtcOffsetNanoseconds,
  wallClockAtOffset,
} from "../../internal";
import { epcisEventTime, epcisTimeZoneOffset } from "../../regex";
import type { EpcisEventTime } from "../../types";

/**
 * When a GS1 EPCIS 2.0 event happened, read three ways: the instant, the UTC offset in force
 * where it happened, and the local wall clock there. The result of `parseEpcisEvent`.
 *
 * `instant` and `offset` are the pair `formatEpcisEvent` and `fromOffsetInstant` take, so the
 * result can be passed to either as it is.
 */
export interface EpcisInstant {
  /**
   * The moment the event happened, as an ISO 8601 instant in UTC ending in `Z`
   * (`2024-06-15T14:30:00Z`). It orders events from every site on one timeline. A fraction is
   * kept to the nanosecond and written without trailing zeros. An `eventTime` whose own offset
   * carries it across either end of years 0000–9999 gives an instant with a sign and a
   * six-digit year.
   */
  instant: string;
  /**
   * The UTC offset in force where the event happened, `±HH:MM`: the event's
   * `eventTimeZoneOffset`, with `-00:00` written as `+00:00`. It is an offset and not a zone, so
   * it says nothing about the local time of any other event.
   */
  offset: string;
  /**
   * The date and time on the local clock where the event happened,
   * `YYYY-MM-DDTHH:MM:SS[.fraction]` with no offset: `instant` shown at `offset`. Its date can be
   * the day before or after the UTC date. A year outside 0000–9999, reachable only within 14
   * hours of either end of the four-digit range, is written with a sign and six digits.
   */
  local: string;
}

/**
 * Read the two required time fields of a GS1 EPCIS 2.0 event as an instant, the UTC offset in
 * force where the event happened, and the local wall clock there.
 *
 * EPCIS (ISO/IEC 19987) is GS1's event standard for supply-chain visibility: each event records
 * what happened to which objects, where, when and why.
 *
 * - **Both fields are required**, as the EPCIS JSON schema requires them. `eventTime` fixes the
 *   instant. `eventTimeZoneOffset` is the offset the local clock ran at where the event
 *   happened, kept so the event can be shown in local time. Neither derives from the other, so
 *   an event without `eventTimeZoneOffset` returns null: UTC is not assumed.
 * - **Each field is checked against the stricter of the two bindings.** `eventTime` takes the
 *   XML binding's pattern (the XSD's `DateTimeStamp`; the JSON schema says only
 *   `format: date-time`). `eventTimeZoneOffset` takes the JSON schema's pattern (the XSD types
 *   it as a bare `xsd:string`), which is the rule the standard states in prose, EPCIS Standard
 *   Release 2.0 §7.4.1 (https://ref.gs1.org/standards/epcis/): an hour "within the range 00
 *   through 14 (inclusive) … except that if the value of the first two digits is 14, the value
 *   of the second two digits must be 00".
 * - **`eventTime`** must match `epcisEventTime`, the `DateTimeStamp` pattern of the EPCIS XSD:
 *   `YYYY-MM-DDTHH:MM:SS`, an optional fraction, then `Z` or a `±HH:MM` offset up to `14:00`.
 *   Seconds are required, `T` and `Z` are upper-case, and nothing may follow: a space separator,
 *   a leap second (`:60`), an expanded year and a bracketed zone or annotation return null. The
 *   pattern checks shape only, so a day the month does not have (`2024-02-30`) is rejected by
 *   Temporal and returns null.
 * - **`eventTimeZoneOffset`** must match `epcisTimeZoneOffset`, the pattern the EPCIS JSON schema
 *   gives: `±HH:MM` from `-14:00` to `+14:00`. `Z`, `+0200`, `+02` and an offset with seconds
 *   return null.
 * - **The two fields are independent and need not agree.** `eventTime` may carry an offset of
 *   its own instead of `Z`; that offset only fixes the instant. The local clock always comes from
 *   `eventTimeZoneOffset`, and a difference between the two is not an error. EPCIS 2.0 §7.4.1.1,
 *   an explanation the standard marks non-normative: "there is no requirement that the time zone
 *   specifier in the XML representation of eventTime be the local time zone offset where the
 *   event was captured".
 * - **An instant can fall outside years 0000–9999.** An `eventTime` whose own offset carries it
 *   across either end of the four-digit years names an instant just past it, written with a sign
 *   and a six-digit year, and `local` is written the same way when it falls outside.
 * - `-00:00` matches the GS1 pattern and is returned as `+00:00`, as `toOffsetInstant` returns
 *   it. RFC 9557 §2.2 reads `-00:00` as "local offset unknown"; the result cannot say that.
 * - **GMT rule: a fraction longer than nine digits returns null.** The XSD allows a fraction of
 *   any length and an instant holds nanoseconds. Dropping digits would report a time the event
 *   does not state, so the value is refused instead, trailing zeros included.
 * - `local` is the instant shown at the offset, so its date can differ from the UTC date.
 * - Only the two fields are read. `recordTime` and every other member of the event are ignored.
 * - Returns null when `event` is not an object, when either field is missing or not a string,
 *   and for every case above.
 *
 * @param event an EPCIS event, or any object with its `eventTime` and `eventTimeZoneOffset`
 * @returns `{ instant, offset, local }`, or null on invalid input
 *
 * @example parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "-05:00" }) // { instant: "2024-06-15T14:30:00Z", offset: "-05:00", local: "2024-06-15T09:30:00" }
 * @example parseEpcisEvent({ eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "+02:00" }) // { instant: "2024-06-15T23:30:00Z", offset: "+02:00", local: "2024-06-16T01:30:00" } (the local date is the next day)
 * @example parseEpcisEvent({ eventTime: "2024-06-15T10:00:00+02:00", eventTimeZoneOffset: "+02:00" }) // { instant: "2024-06-15T08:00:00Z", offset: "+02:00", local: "2024-06-15T10:00:00" }
 * @example parseEpcisEvent({ eventTime: "2024-06-15T10:00:00+02:00", eventTimeZoneOffset: "-05:00" }) // { instant: "2024-06-15T08:00:00Z", offset: "-05:00", local: "2024-06-15T03:00:00" } (the two offsets need not agree)
 * @example parseEpcisEvent({ eventTime: "2024-06-15T14:30:00.123456789Z", eventTimeZoneOffset: "+05:45" }) // { instant: "2024-06-15T14:30:00.123456789Z", offset: "+05:45", local: "2024-06-15T20:15:00.123456789" }
 * @example parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "-00:00" }) // { instant: "2024-06-15T14:30:00Z", offset: "+00:00", local: "2024-06-15T14:30:00" }
 * @example parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z" }) // null (eventTimeZoneOffset is required)
 * @example parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "Z" }) // null (a designator, not an offset)
 * @example parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "+0200" }) // null (no colon)
 * @example parseEpcisEvent({ eventTime: "2024-06-15T14:30Z", eventTimeZoneOffset: "+02:00" }) // null (seconds are required)
 * @example parseEpcisEvent({ eventTime: "2024-06-15 14:30:00Z", eventTimeZoneOffset: "+02:00" }) // null (a space separator)
 * @example parseEpcisEvent({ eventTime: "2024-02-30T14:30:00Z", eventTimeZoneOffset: "+02:00" }) // null (30 February)
 * @example parseEpcisEvent({ eventTime: "2024-06-15T14:30:00.1234567891Z", eventTimeZoneOffset: "+02:00" }) // null (finer than a nanosecond)
 */
export function parseEpcisEvent(event: EpcisEventTime): EpcisInstant | null {
  try {
    if (!isObject(event)) {
      return null;
    }

    const { eventTime, eventTimeZoneOffset } = event;

    if (
      typeof eventTime !== "string" ||
      typeof eventTimeZoneOffset !== "string" ||
      !epcisEventTime.test(eventTime) ||
      !epcisTimeZoneOffset.test(eventTimeZoneOffset)
    ) {
      return null;
    }

    // `epcisEventTime` admits no bracket, so there is no zone whose minute-rounded offset could
    // change the reading and `Temporal.Instant.from` is the whole parse. It also does the two
    // checks the pattern cannot: a day the month does not have, and a fraction past nine digits
    // (Temporal's grammar stops at nanoseconds), both a RangeError.
    const instant = Temporal.Instant.from(eventTime);

    // Temporal reads the offset and writes it back, so `-00:00` comes out as `+00:00` and no
    // offset digit is sliced by hand.
    const offsetNanoseconds = parseUtcOffsetNanoseconds(eventTimeZoneOffset);
    const offset =
      offsetNanoseconds === null ? null : formatUtcOffset(offsetNanoseconds);

    if (offsetNanoseconds === null || offset === null) {
      return null;
    }

    return {
      instant: instant.toString(),
      offset,
      local: wallClockAtOffset(instant, offsetNanoseconds).toString(),
    };
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
