import { Temporal } from "@js-temporal/polyfill";
import {
  formatUtcOffset,
  isObject,
  parseInstantNanoseconds,
  parseUtcOffsetNanoseconds,
} from "../../internal";
import type { OffsetInstant } from "../../instant/convert/toOffsetInstant";
import { epcisEventTime, epcisTimeZoneOffset } from "../../regex";
import type { EpcisEventTime } from "../../types";

/**
 * Write an instant-plus-offset pair as the two required time fields of a GS1 EPCIS 2.0 event.
 *
 * EPCIS (ISO/IEC 19987) is GS1's event standard for supply-chain visibility. Every event must
 * carry `eventTime`, the instant, and `eventTimeZoneOffset`, the offset the local clock ran at
 * where the event happened. The inverse of `parseEpcisEvent`, whose result it takes as it is.
 *
 * - **`eventTime` is the instant in UTC, ending in `Z`**, as `Temporal.Instant.prototype.toString`
 *   writes it: seconds always present, and a fraction kept to the nanosecond with no trailing
 *   zeros and no padding. It always matches `epcisEventTime`, the `DateTimeStamp` pattern of
 *   the EPCIS XSD, and so is valid in the XML binding and in the JSON one (`format: date-time`).
 * - **`eventTimeZoneOffset` is `offset`**, which must match `epcisTimeZoneOffset`, the pattern
 *   of the EPCIS JSON schema and the rule of EPCIS Standard Release 2.0 §7.4.1
 *   (https://ref.gs1.org/standards/epcis/): `±HH:MM` from `-14:00` to `+14:00`. That is narrower than the offsets a pair can hold, so an offset with
 *   seconds (`+05:30:00`, `-00:44:30`), one past 14 hours (`+14:30`) and `Z` return null, although
 *   `fromOffsetInstant` accepts some of them. Nothing is rounded to fit.
 * - `-00:00` matches the GS1 pattern and is written as `+00:00`, the spelling `parseEpcisEvent`
 *   returns.
 * - `instant` is any instant `isValidInstant` accepts: `Z`, an offset, or an offset with a
 *   bracketed zone. Only the instant is read, so an offset written in `instant` does not have to
 *   equal `offset`.
 * - **`timeZone` is not read.** EPCIS has no field for a zone, so a pair's zone is dropped, and
 *   one that is invalid or disagrees with `offset` changes nothing. `fromOffsetInstant` is the
 *   function that checks a zone against its offset.
 * - `eventTime` has a four-digit year, so an instant whose UTC year is outside 0000–9999 returns
 *   null. `parseEpcisEvent` can return one, from an `eventTime` whose own offset carries it
 *   across either end of that range, and such a result cannot be written back.
 * - Returns null when `value` is not an object, when `instant` is not a valid instant, and when
 *   `offset` is missing, not a string, or outside the GS1 pattern.
 *
 * @param value `{ instant, offset }` pair, as `parseEpcisEvent` or `toOffsetInstant` returns it
 * @returns `{ eventTime, eventTimeZoneOffset }`, or null on invalid input
 *
 * @example formatEpcisEvent({ instant: "2024-06-15T14:30:00Z", offset: "-05:00" }) // { eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "-05:00" }
 * @example formatEpcisEvent({ instant: "2024-06-15T09:30:00-05:00", offset: "-05:00" }) // { eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "-05:00" } (the instant is written in UTC)
 * @example formatEpcisEvent({ instant: "2024-06-15T14:30:00.120Z", offset: "+05:45" }) // { eventTime: "2024-06-15T14:30:00.12Z", eventTimeZoneOffset: "+05:45" }
 * @example formatEpcisEvent({ instant: "2024-06-15T14:30:00Z", offset: "-04:00", timeZone: "America/New_York" }) // { eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "-04:00" } (EPCIS carries no zone)
 * @example formatEpcisEvent({ instant: "2024-06-15T14:30:00Z", offset: "-00:00" }) // { eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "+00:00" }
 * @example formatEpcisEvent({ instant: "2024-06-15T14:30:00Z", offset: "+14:30" }) // null (past the range GS1 allows)
 * @example formatEpcisEvent({ instant: "2024-06-15T14:30:00Z", offset: "+05:30:00" }) // null (GS1 offsets have no seconds)
 * @example formatEpcisEvent({ instant: "2024-06-15T14:30:00Z", offset: "Z" }) // null (a designator, not an offset)
 * @example formatEpcisEvent({ instant: "2024-06-15T14:30:00", offset: "-05:00" }) // null (no offset: not an instant)
 * @example formatEpcisEvent({ instant: "+010000-01-01T00:00:00Z", offset: "-05:00" }) // null (eventTime has a four-digit year)
 */
export function formatEpcisEvent(value: OffsetInstant): EpcisEventTime | null {
  try {
    if (!isObject(value)) {
      return null;
    }

    const { instant, offset } = value;

    // GS1's pattern is tested on the offset as written, before it is canonicalised: `+05:30:00`
    // names the same offset as `+05:30`, and it is still not a value the field can hold.
    if (typeof offset !== "string" || !epcisTimeZoneOffset.test(offset)) {
      return null;
    }

    const epochNanoseconds = parseInstantNanoseconds(instant);
    // Temporal reads the offset and writes it back, so `-00:00` comes out as `+00:00`, as it
    // does from `parseEpcisEvent`.
    const offsetNanoseconds = parseUtcOffsetNanoseconds(offset);
    const eventTimeZoneOffset =
      offsetNanoseconds === null ? null : formatUtcOffset(offsetNanoseconds);

    if (epochNanoseconds === null || eventTimeZoneOffset === null) {
      return null;
    }

    const eventTime =
      Temporal.Instant.fromEpochNanoseconds(epochNanoseconds).toString();

    // Temporal writes a year outside 0000–9999 with a sign and six digits, which `eventTime`
    // cannot carry. The pattern is the check, so no year is compared by hand.
    return epcisEventTime.test(eventTime)
      ? { eventTime, eventTimeZoneOffset }
      : null;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
