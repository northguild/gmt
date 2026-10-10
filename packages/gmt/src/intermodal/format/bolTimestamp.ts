import {
  frameWallClock,
  instantFrom,
  isOptionsArgument,
  zoneFrame,
} from "../../internal";
import { isValidInstant } from "../../precision/validate/isValidInstant";

/**
 * Which date on a bill of lading a value is rendered for, one per dated field of the DCSA
 * Bill of Lading 3.0 `TransportDocument`:
 *
 * - `issue`: the date the B/L was issued, local to the place of issue (DCSA `issueDate`).
 * - `received`: the date the last container was in the terminal, customs-cleared against the
 *   intended vessel, on a received-for-shipment B/L (DCSA `receivedForShipmentDate`).
 * - `shippedOnBoard`: the date the last container was loaded aboard the vessel, on a
 *   shipped-on-board B/L (DCSA `shippedOnBoardDate`).
 *
 * All three are local calendar dates, so each renders the same way.
 */
export type BillOfLadingEvent = "issue" | "received" | "shippedOnBoard";

/** Options for `bolTimestamp`. */
export interface BolTimestampOptions {
  /**
   * The zone of the place the event happened, as an IANA name or a UTC offset: the place of issue
   * for `issue`, and the terminal at the port of loading for `received` and `shippedOnBoard`. A UTC
   * offset is a time zone identifier (`+05:30`, `+0530`, `-08`) or a stored offset (`±HH:MM[:SS]`,
   * what `getTimeZoneOffset` returns). It is required, because every B/L date is local and a UTC
   * date is a different date for part of every day.
   */
  timeZone: string;
}

/** The three `BillOfLadingEvent` values. */
const BILL_OF_LADING_EVENTS: ReadonlySet<unknown> = new Set<BillOfLadingEvent>([
  "issue",
  "received",
  "shippedOnBoard",
]);

/**
 * Render an instant as the date a bill of lading carries for an event: the calendar date on the
 * local clock where the event happened.
 *
 * A B/L date is a contractual date, not a timestamp. The DCSA Bill of Lading 3.0 standard
 * (`TransportDocument`) types `issueDate` ("Local date when the transport document has been
 * issued"), `receivedForShipmentDate` and `shippedOnBoardDate` as `format: date`: a date with no
 * time and no offset. A system that records the loading as an instant has to turn it back into
 * that local date, and taking the UTC date gets it wrong in both directions: 21:00 in New York is
 * 01:00Z the next day, and 07:00 in Shanghai is 23:00Z the day before.
 *
 * - **The result is a date with no time component**, `YYYY-MM-DD`, as
 *   `Temporal.PlainDate.prototype.toString` writes it. A year outside 0000–9999 is written with a
 *   sign and six digits (`"+275760-09-13"`).
 * - **`timeZone` is required.** Every B/L date is local, so there is no UTC default and no
 *   system zone: omitting it returns `""`. The zone is the caller's fact; GMT does not resolve a
 *   port or a place of issue to a zone.
 * - **`event` names which date this is** and is checked against the three `BillOfLadingEvent`
 *   values; anything else returns `""`. All three are local calendar dates, so they render the
 *   same way: the event keeps the call site honest about which field it fills, and the zone is the
 *   one that differs by event.
 * - `value` is any instant `isValidInstant` accepts: `Z`, an offset, or an offset with a
 *   bracketed zone. Only the instant is read; a bracketed zone in `value` is not the zone the date
 *   is read in, `timeZone` is. An offset written to the minute that is the bracketed zone's
 *   sub-minute offset rounded (`-00:45[Africa/Monrovia]`, for −00:44:30) names the instant the
 *   zone gives. A zoneless wall time or a bare date names no moment and returns `""`.
 * - **No disambiguation arises.** The input is a moment, and a moment has exactly one local date
 *   in any zone. The date changes at the zone's real midnight. A date the zone deleted is never
 *   returned (`Pacific/Apia` skipped 2011-12-30), and after a fall-back that re-enters the
 *   previous date the result is that date again, as the clock showed it (`America/Goose_Bay`,
 *   7 November 2010).
 * - Returns `""` when `value` is not an instant, `event` is not one of the three, `options` is not
 *   an object, or `timeZone` is missing or invalid.
 *
 * @param value ISO 8601 instant string of the event (e.g. "2024-06-16T01:00:00Z")
 * @param event which B/L date the value is rendered for
 * @param options The zone of the place the event happened
 * @returns the local calendar date as "YYYY-MM-DD", or "" on invalid input
 *
 * @example bolTimestamp("2024-06-16T01:00:00Z", "shippedOnBoard", { timeZone: "America/New_York" }) // "2024-06-15" (loaded at 21:00 local; the UTC date is the 16th)
 * @example bolTimestamp("2024-06-14T23:00:00Z", "shippedOnBoard", { timeZone: "Asia/Shanghai" }) // "2024-06-15" (loaded at 07:00 local; the UTC date is the 14th)
 * @example bolTimestamp("2024-06-15T21:00:00-04:00", "received", { timeZone: "America/New_York" }) // "2024-06-15"
 * @example bolTimestamp("2024-06-16T09:00:00+08:00[Asia/Shanghai]", "issue", { timeZone: "America/New_York" }) // "2024-06-15" (the bracketed zone is not the zone the date is read in)
 * @example bolTimestamp("2024-06-16T01:00:00Z", "shippedOnBoard", { timeZone: "+08:00" }) // "2024-06-16" (a fixed offset)
 * @example bolTimestamp("2011-12-30T10:00:00Z", "shippedOnBoard", { timeZone: "Pacific/Apia" }) // "2011-12-31" (Samoa deleted 30 December)
 * @example bolTimestamp("2024-06-16T01:00:00Z", "shippedOnBoard") // "" (every B/L date is local: the zone is required)
 * @example bolTimestamp("2024-06-16T01:00:00Z", "loaded", { timeZone: "America/New_York" }) // "" (not a B/L event)
 * @example bolTimestamp("2024-06-15T21:00:00", "shippedOnBoard", { timeZone: "America/New_York" }) // "" (no offset: not a moment)
 * @example bolTimestamp("2024-06-16T01:00:00Z", "shippedOnBoard", { timeZone: "America/Nowhere" }) // ""
 * @example bolTimestamp("1970-01-01T00:30:00Z", "issue", { timeZone: "-00:44:30" }) // "1969-12-31" (23:45:30 the day before, at a stored offset with seconds)
 */
export function bolTimestamp(
  value: string,
  event: BillOfLadingEvent,
  options: BolTimestampOptions,
): string {
  try {
    if (options === undefined || !isOptionsArgument(options)) {
      return "";
    }
    const frame = zoneFrame(options.timeZone);
    if (
      frame === null ||
      !BILL_OF_LADING_EVENTS.has(event) ||
      !isValidInstant(value)
    ) {
      return "";
    }

    return frameWallClock(instantFrom(value), frame).toPlainDate().toString();
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
