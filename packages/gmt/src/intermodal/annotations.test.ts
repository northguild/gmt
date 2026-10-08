import {
  bolTimestamp,
  chargeableDays,
  demurrageClock,
  formatEdifactDtm,
  formatEpcisEvent,
  freeTimeExpiry,
  multimodalETA,
  parseEpcisEvent,
} from "./index";

/**
 * RFC 9557 annotations on an intermodal instant, read by every intermodal function that takes an
 * ISO 8601 instant.
 *
 * RFC 9557 §3.3: an elective annotation with an unknown key is ignored and a critical one
 * (`!`) is rejected; `u-ca` is a known key, so a calendar is accepted either way. A time-zone
 * annotation is a bracket without `=` (RFC 9557 §4.1 `time-zone`), and `!` on it is allowed.
 * `freeTimeExpiry` and `chargeableDays` read only the instant (the counting zone is an option),
 * as `Temporal.Instant.from` and `isValidInstant` do, so a bracketed zone that does not exist is
 * accepted; `demurrageClock` validates each event the same way and echoes its string.
 * `bolTimestamp` reads only the instant too (the date's zone is its `timeZone` option).
 * `multimodalETA` schedules with `scheduleDelivery`, whose departure reads its bracket to make the
 * departure exact, so there the zone must be real.
 *
 * The EDI and EPCIS functions (INT-15):
 *
 * - `formatEpcisEvent` reads only the instant of its pair (EPCIS has no field for a zone), so it
 *   accepts what `isValidInstant` accepts and writes the same `eventTime` for every accepted row.
 * - `parseEpcisEvent` reads GS1's `eventTime` grammar (the `DateTimeStamp` pattern of the EPCIS
 *   XSD), which ends at `Z` or the offset: it has no annotation, so every bracketed value is
 *   null and only the bare instant is read. `isValidEpcisEvent` is the same check.
 * - `formatEdifactDtm` under `303` (and `205`–`208`, `301`, `302`, `304`, which read their value
 *   the same way) writes the value's own wall clock and offset, so it reads the bracket through
 *   `toOffsetInstant`: a zone must be real, and it sets the clock the digits are written on.
 *   19:00Z in `Europe/London` on 14 June 2024 is 20:00 at +01:00 (British Summer Time), checked
 *   against `Temporal.Instant.from("2024-06-14T19:00:00Z").toZonedDateTimeISO("Europe/London")`.
 *
 * Not here, because they read no ISO 8601 instant: `parseEdifactDtm`, `parseX12DateTimePeriod`,
 * `parseX12DateTime`, `x12TimeCode` and their validators read EDI element values, which have no
 * bracket; `formatX12DateTimePeriod` takes a date, a time or a local date-time, since no 1250
 * code carries an offset; and the `formatEdifactDtm` codes with no offset take the same. For the
 * same reason none of them has a row in `test/minuteRoundedOffsets.test.ts`.
 */
const clockStart = "2024-06-14T19:00:00Z";
const terms = {
  basis: "calendar",
  chargeBasis: "calendar",
  timeZone: "UTC",
  firstDay: "eventDay",
} as const;

describe("intermodal annotations (RFC 9557)", () => {
  // `dtm303` is the instant placed under `CCYYMMDDHHMMZZZ` on the clock of the zone the value
  // names: 14 June 2024 19:00 at `+00` for `Z` and `[UTC]`, 20:00 at `+01` for `[Europe/London]`.
  it.each`
    annotation               | accepted | departure | dtm303               | kind
    ${""}                    | ${true}  | ${true}   | ${"202406141900+00"} | ${"no annotation"}
    ${"[foo=bar]"}           | ${true}  | ${true}   | ${"202406141900+00"} | ${"elective unknown key: ignored"}
    ${"[!foo=bar]"}          | ${false} | ${false}  | ${""}                | ${"critical unknown key: rejected"}
    ${"[u-ca=gregory]"}      | ${true}  | ${true}   | ${"202406141900+00"} | ${"elective calendar: an instant has none"}
    ${"[!u-ca=gregory]"}     | ${true}  | ${true}   | ${"202406141900+00"} | ${"critical calendar: a known key"}
    ${"[UTC]"}               | ${true}  | ${true}   | ${"202406141900+00"} | ${"elective zone"}
    ${"[!UTC]"}              | ${true}  | ${true}   | ${"202406141900+00"} | ${"critical zone"}
    ${"[Europe/London]"}     | ${true}  | ${true}   | ${"202406142000+01"} | ${"zone differing from Z: it sets the wall clock a 303 value is written on"}
    ${"[UTC][foo=bar]"}      | ${true}  | ${true}   | ${"202406141900+00"} | ${"zone then elective unknown key"}
    ${"[UTC][!foo=bar]"}     | ${false} | ${false}  | ${""}                | ${"zone then critical unknown key"}
    ${"[UTC][u-ca=iso8601]"} | ${true}  | ${true}   | ${"202406141900+00"} | ${"zone then ISO calendar"}
    ${"[Not/AZone]"}         | ${true}  | ${false}  | ${""}                | ${"zone that does not exist: only the instant is read, but a departure's bracket and a 303 value's zone must be real"}
  `(
    "reads $annotation on an instant consistently ($kind)",
    ({ annotation, accepted, departure, dtm303 }) => {
      const value = `${clockStart}${annotation}`;

      expect(freeTimeExpiry(value, 1, terms)).toEqual(
        accepted
          ? {
              freeTimeStart: "2024-06-14",
              lastFreeDay: "2024-06-14",
              expiresAt: "2024-06-15T00:00:00Z",
            }
          : null,
      );
      expect(chargeableDays(value, value, 1, terms)).toEqual(
        accepted
          ? {
              freeDaysUsed: 1,
              chargeableDays: 0,
              expiresAt: "2024-06-15T00:00:00Z",
              chargedDates: [],
              byTier: [{ from: 1, to: null, days: 0 }],
            }
          : null,
      );
      expect(
        demurrageClock(
          [
            { type: "discharged", at: value },
            { type: "gatedOut", at: value },
          ],
          "demurrage",
          { direction: "import" },
        ),
      ).toEqual(accepted ? { start: value, end: value } : null);
      expect(bolTimestamp(value, "shippedOnBoard", { timeZone: "UTC" })).toBe(
        accepted ? "2024-06-14" : "",
      );
      // EPCIS has no field for a zone: only the instant is read, and it is written in UTC.
      expect(formatEpcisEvent({ instant: value, offset: "+00:00" })).toEqual(
        accepted
          ? { eventTime: clockStart, eventTimeZoneOffset: "+00:00" }
          : null,
      );
      // GS1's `eventTime` grammar has no annotation, so only the bare instant is an event time.
      expect(
        parseEpcisEvent({ eventTime: value, eventTimeZoneOffset: "+00:00" }),
      ).toEqual(
        annotation === ""
          ? {
              instant: clockStart,
              offset: "+00:00",
              local: "2024-06-14T19:00:00",
            }
          : null,
      );
      // A 303 value is the wall clock and its offset, so the bracketed zone is read.
      expect(formatEdifactDtm(value, "303")).toBe(dtm303);
      // A departure's bracket makes it exact, so a zone that does not exist is refused.
      expect(
        multimodalETA([
          { departure: value, duration: "PT1H", timeZone: "UTC" },
        ]),
      ).toEqual(
        departure
          ? {
              eta: "2024-06-14T20:00:00+00:00[UTC]",
              totalLegs: 1,
              totalTransit: "PT1H",
              totalDwell: "PT0S",
            }
          : null,
      );
    },
  );
});
