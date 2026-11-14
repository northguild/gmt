import {
  bolTimestamp,
  chargeableDays,
  demurrageClock,
  formatEdifactOffsetDateTime,
  formatEpcisEvent,
  freeTimeExpiry,
  multimodalETA,
  parseEpcisEvent,
} from "./index";

/**
 * Annotations on an intermodal moment, read by every intermodal function that takes an ISO 8601
 * instant.
 *
 * Each function reads its kind's exact pattern over the whole string, with no junk after it.
 * `freeTimeExpiry`, `chargeableDays`, `demurrageClock` and `bolTimestamp` read an instant (the
 * counting zone is an option, and `demurrageClock` echoes the strings it is given), so they take
 * `…Z` or `…±HH:MM[:SS]` and no annotation of any kind. `formatEpcisEvent` reads an instant too,
 * and `parseEpcisEvent` reads GS1's `eventTime` grammar (the `DateTimeStamp` pattern of the EPCIS
 * XSD), which ends at `Z` or the offset.
 *
 * `multimodalETA` schedules with `scheduleDelivery`, and `formatEdifactOffsetDateTime` under
 * `303` (and `205`, `208` and `304`) writes the value's own wall clock and offset through
 * `toOffsetInstant`. Both keep a zone, so they read the body plus one real zone bracket, and
 * nothing else: no calendar or elective annotation and no second bracket. 19:00Z in
 * `Europe/London` on 14 June 2024 is 20:00 at +01:00 (British Summer Time), checked against
 * `Temporal.Instant.from("2024-06-14T19:00:00Z").toZonedDateTimeISO("Europe/London")`.
 *
 * Not here, because they read no ISO 8601 instant: the `parseEdifact…` and `parseX12…` functions,
 * `x12TimeCodeOffset`, `x12TimeCodeZone` and their validators read EDI element values, which
 * have no bracket; the `formatX12…` functions take a date, a time or a local date-time, since no
 * 1250 code carries an offset; and the other `formatEdifact…` functions take the same.
 */
const clockStart = "2024-06-14T19:00:00Z";
const terms = {
  basis: "calendar",
  chargeBasis: "calendar",
  timeZone: "UTC",
  firstDay: "eventDay",
} as const;

describe("intermodal annotations (RFC 9557)", () => {
  // `dtm303` is the instant placed under `CCYYMMDDHHMMZZZ`: 14 June 2024 19:00 at `+00` for the
  // bare `Z` instant. A 303 value is an instant, so any annotation, a real zone included, is refused.
  it.each`
    annotation               | zoned    | dtm303               | kind
    ${""}                    | ${true}  | ${"202406141900+00"} | ${"no annotation"}
    ${"[foo=bar]"}           | ${false} | ${""}                | ${"elective unknown key"}
    ${"[!foo=bar]"}          | ${false} | ${""}                | ${"critical unknown key"}
    ${"[u-ca=gregory]"}      | ${false} | ${""}                | ${"elective calendar"}
    ${"[!u-ca=gregory]"}     | ${false} | ${""}                | ${"critical calendar"}
    ${"[u-ca=iso8601]"}      | ${false} | ${""}                | ${"ISO calendar"}
    ${"[UTC]"}               | ${true}  | ${""}                | ${"zone"}
    ${"[!UTC]"}              | ${true}  | ${""}                | ${"critical zone"}
    ${"[Europe/London]"}     | ${true}  | ${""}                | ${"zone differing from Z"}
    ${"[+01:00]"}            | ${true}  | ${""}                | ${"offset zone"}
    ${"[UTC][foo=bar]"}      | ${false} | ${""}                | ${"zone then elective unknown key"}
    ${"[UTC][!foo=bar]"}     | ${false} | ${""}                | ${"zone then critical unknown key"}
    ${"[UTC][u-ca=iso8601]"} | ${false} | ${""}                | ${"zone then ISO calendar"}
    ${"[Not/AZone]"}         | ${false} | ${""}                | ${"zone that does not exist"}
  `(
    "reads '$annotation' on a moment by its kind ($kind)",
    ({ annotation, zoned, dtm303 }) => {
      const accepted = annotation === "";
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
      // A 303 value is an instant: only the bare one is written, and any annotation is refused.
      expect(formatEdifactOffsetDateTime(value, "303")).toBe(dtm303);
      // A departure keeps its zone: body plus one real zone bracket.
      expect(
        multimodalETA([
          { departure: value, duration: "PT1H", timeZone: "UTC" },
        ]),
      ).toEqual(
        zoned
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
