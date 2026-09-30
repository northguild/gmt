import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import {
  dateLineCrossingAt,
  dateLineCrossingTimeZones,
} from "../../test/timeZoneMatrix";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import type { BusinessCalendar } from "../../types";
import { cutoffAt } from "./cutoffAt";

/** A vessel leaving Friday 14 June 2024 at 18:00 in Amsterdam (+02:00, summer time). */
const departure = "2024-06-14T16:00:00Z";
const amsterdam = "Europe/Amsterdam";
const newYork = "America/New_York";

/** Saturday–Sunday weekend, no holidays. */
const weekdays: BusinessCalendar = {
  weekend: [6, 7],
  holidays: [],
  timeZone: amsterdam,
};

describe("cutoffAt", () => {
  // Expected values derived by hand from the rule (the offset's exact part off the anchor's
  // instant, its calendar part off the local date or wall clock, then atLocalTime) and checked
  // against plain @js-temporal/polyfill ZonedDateTime/PlainDate arithmetic.
  describe("the ocean cut-off stack", () => {
    it.each`
      cutoff        | offset     | atLocalTime  | expected
      ${"document"} | ${"P2D"}   | ${"17:00"}   | ${"2024-06-12T17:00:00+02:00[Europe/Amsterdam]"}
      ${"VGM"}      | ${"P1D"}   | ${"10:00"}   | ${"2024-06-13T10:00:00+02:00[Europe/Amsterdam]"}
      ${"gate-in"}  | ${"P1D"}   | ${undefined} | ${"2024-06-13T18:00:00+02:00[Europe/Amsterdam]"}
      ${"customs"}  | ${"PT24H"} | ${undefined} | ${"2024-06-13T18:00:00+02:00[Europe/Amsterdam]"}
    `(
      "puts the $cutoff cut-off at $expected for a Friday 18:00 departure",
      ({ offset, atLocalTime, expected }) => {
        expect(
          cutoffAt(departure, offset, { timeZone: amsterdam, atLocalTime }),
        ).toBe(expected);
      },
    );

    // Wednesday 17:00 is 49 hours before Friday 18:00, not 48: the tariff means close of
    // business two days before, which no duration expresses.
    it("pins P2D to 17:00 local, where subtracting PT48H keeps the departure's 18:00", () => {
      expect(
        cutoffAt(departure, "P2D", {
          timeZone: amsterdam,
          atLocalTime: "17:00",
        }),
      ).toBe("2024-06-12T17:00:00+02:00[Europe/Amsterdam]");
      expect(cutoffAt(departure, "PT48H", { timeZone: amsterdam })).toBe(
        "2024-06-12T18:00:00+02:00[Europe/Amsterdam]",
      );
    });

    it.each`
      anchor                    | expected
      ${"2024-06-14T16:00:00Z"} | ${"2024-06-12T17:00:00+02:00[Europe/Amsterdam]"}
      ${"2024-06-15T16:00:00Z"} | ${"2024-06-13T17:00:00+02:00[Europe/Amsterdam]"}
      ${"2024-06-13T16:00:00Z"} | ${"2024-06-11T17:00:00+02:00[Europe/Amsterdam]"}
    `(
      "moves with the anchor: a departure at $anchor gives $expected",
      ({ anchor, expected }) => {
        expect(
          cutoffAt(anchor, "P2D", {
            timeZone: amsterdam,
            atLocalTime: "17:00",
          }),
        ).toBe(expected);
      },
    );
  });

  describe("across a DST transition", () => {
    // Monday 11 March 2024 18:00 EDT; New York sprang forward on Sunday 10 March.
    const monday = "2024-03-11T18:00:00-04:00[America/New_York]";

    it.each`
      offset     | atLocalTime  | expected                                         | elapsed
      ${"P2D"}   | ${"17:00"}   | ${"2024-03-09T17:00:00-05:00[America/New_York]"} | ${"PT48H"}
      ${"P2D"}   | ${undefined} | ${"2024-03-09T18:00:00-05:00[America/New_York]"} | ${"PT47H"}
      ${"PT48H"} | ${undefined} | ${"2024-03-09T17:00:00-05:00[America/New_York]"} | ${"PT48H"}
    `(
      "$offset at $atLocalTime keeps the local clock and lets the elapsed time differ ($elapsed)",
      ({ offset, atLocalTime, expected, elapsed }) => {
        const result = cutoffAt(monday, offset, {
          timeZone: newYork,
          atLocalTime,
        });
        expect(result).toBe(expected);
        expect(
          Temporal.ZonedDateTime.from(result)
            .until(Temporal.ZonedDateTime.from(monday), {
              largestUnit: "hours",
            })
            .toString(),
        ).toBe(elapsed);
      },
    );

    // Arrival Tuesday 5 November 2024 12:00 EST; New York fell back on Sunday 3 November.
    // A 96-hour offset is exact elapsed time, so it reads 13:00 EDT on Friday; P4D keeps 12:00
    // and is 97 hours.
    it("counts a 96-hour offset from arrival as exact elapsed time", () => {
      const arrival = "2024-11-05T17:00:00Z";
      expect(cutoffAt(arrival, "PT96H", { timeZone: newYork })).toBe(
        "2024-11-01T13:00:00-04:00[America/New_York]",
      );
      expect(cutoffAt(arrival, "P4D", { timeZone: newYork })).toBe(
        "2024-11-01T12:00:00-04:00[America/New_York]",
      );
    });
  });

  describe("the anchor is the caller's event", () => {
    // Loading at 08:00Z on 10 June, departure at 20:00Z on 12 June: the same 24-hour rule is
    // two and a half days apart depending on which event it is counted from.
    it("gives a different deadline for the same offset from loading and from departure", () => {
      const loading = "2024-06-10T08:00:00Z";
      const leaving = "2024-06-12T20:00:00Z";
      const options = { timeZone: "Asia/Shanghai" };
      expect([
        cutoffAt(loading, "PT24H", options),
        cutoffAt(leaving, "PT24H", options),
      ]).toEqual([
        "2024-06-09T16:00:00+08:00[Asia/Shanghai]",
        "2024-06-12T04:00:00+08:00[Asia/Shanghai]",
      ]);
    });
  });

  describe("rolling off non-business days", () => {
    const withHoliday: BusinessCalendar = {
      weekend: [6, 7],
      holidays: ["2024-06-12"],
      timeZone: amsterdam,
    };

    it.each`
      anchor                    | calendar       | roll                   | expected                                         | why
      ${"2024-06-18T16:00:00Z"} | ${weekdays}    | ${undefined}           | ${""}                                            | ${"a calendar with no roll convention is refused: there is no default"}
      ${"2024-06-18T16:00:00Z"} | ${weekdays}    | ${"preceding"}         | ${"2024-06-14T17:00:00+02:00[Europe/Amsterdam]"} | ${"Sunday rolls back to Friday"}
      ${"2024-06-18T16:00:00Z"} | ${weekdays}    | ${"following"}         | ${"2024-06-17T17:00:00+02:00[Europe/Amsterdam]"} | ${"the caller asked for later"}
      ${"2024-06-18T16:00:00Z"} | ${weekdays}    | ${"none"}              | ${"2024-06-16T17:00:00+02:00[Europe/Amsterdam]"} | ${"unadjusted"}
      ${departure}              | ${withHoliday} | ${undefined}           | ${""}                                            | ${"a holiday with no roll convention is refused"}
      ${departure}              | ${withHoliday} | ${"preceding"}         | ${"2024-06-11T17:00:00+02:00[Europe/Amsterdam]"} | ${"a Wednesday holiday rolls back to Tuesday, never forward"}
      ${"2024-06-18T16:00:00Z"} | ${weekdays}    | ${"endOfMonth"}        | ${"2024-06-28T17:00:00+02:00[Europe/Amsterdam]"} | ${"endOfMonth is not checked against the anchor: ten days after it"}
      ${departure}              | ${withHoliday} | ${"modifiedFollowing"} | ${"2024-06-13T17:00:00+02:00[Europe/Amsterdam]"} | ${"forward stays in June"}
      ${departure}              | ${weekdays}    | ${"following"}         | ${"2024-06-12T17:00:00+02:00[Europe/Amsterdam]"} | ${"a working day is left alone"}
    `("$why", ({ anchor, calendar, roll, expected }) => {
      expect(
        cutoffAt(anchor, "P2D", {
          timeZone: amsterdam,
          atLocalTime: "17:00",
          calendar,
          roll,
        }),
      ).toBe(expected);
    });

    // Without atLocalTime the rolled day keeps the offset result's local time of day.
    it("keeps the local time of day when it rolls an unpinned cut-off", () => {
      // Tuesday 18:00 minus P2D is Sunday 18:00, rolled back to Friday 18:00.
      expect(
        cutoffAt("2024-06-18T16:00:00Z", "P2D", {
          timeZone: amsterdam,
          calendar: weekdays,
          roll: "preceding",
        }),
      ).toBe("2024-06-14T18:00:00+02:00[Europe/Amsterdam]");
    });

    // The departure 02:30 EDT on Tuesday 12 March minus 24 hours is Monday 02:30, a holiday;
    // rolled back to Sunday 10 March, 02:30 is the hour New York skipped.
    it("returns the sentinel when the rolled day's wall time does not exist", () => {
      expect(
        cutoffAt("2024-03-12T02:30:00-04:00[America/New_York]", "PT24H", {
          timeZone: newYork,
          calendar: {
            weekend: [],
            holidays: ["2024-03-11"],
            timeZone: newYork,
          },
          roll: "preceding",
        }),
      ).toBe("");
    });
  });

  describe("local wall times that are not one-to-one", () => {
    it.each`
      anchor                                              | offset    | atLocalTime  | timeZone                 | expected                                            | why
      ${"2024-03-11T18:00:00-04:00[America/New_York]"}    | ${"P1D"}  | ${"02:30"}   | ${newYork}               | ${""}                                               | ${"02:30 on 10 March was skipped"}
      ${"2024-03-12T02:30:00-04:00[America/New_York]"}    | ${"P2D"}  | ${undefined} | ${newYork}               | ${""}                                               | ${"two days before 02:30 is the skipped hour"}
      ${"2024-03-12T02:30:00-04:00[America/New_York]"}    | ${"P2D"}  | ${"17:00"}   | ${newYork}               | ${"2024-03-10T17:00:00-04:00[America/New_York]"}    | ${"pinned, only the date of the skipped hour is read"}
      ${"2024-11-04T18:00:00-05:00[America/New_York]"}    | ${"P1D"}  | ${"01:30"}   | ${newYork}               | ${"2024-11-03T01:30:00-04:00[America/New_York]"}    | ${"a repeated 01:30 takes the earlier pass"}
      ${"2024-11-04T01:30:00-05:00[America/New_York]"}    | ${"P1D"}  | ${undefined} | ${newYork}               | ${"2024-11-03T01:30:00-04:00[America/New_York]"}    | ${"the repeated hour from a calendar day, earlier pass"}
      ${"2024-11-03T06:30:00Z"}                           | ${"PT0S"} | ${undefined} | ${newYork}               | ${"2024-11-03T01:30:00-05:00[America/New_York]"}    | ${"an exact result is never re-resolved"}
      ${"2024-04-08T18:00:00+10:30[Australia/Lord_Howe]"} | ${"P1D"}  | ${"01:45"}   | ${"Australia/Lord_Howe"} | ${"2024-04-07T01:45:00+11:00[Australia/Lord_Howe]"} | ${"a 30-minute overlap takes the earlier pass"}
      ${"2024-09-30T18:00:00+13:45[Pacific/Chatham]"}     | ${"P1D"}  | ${"03:15"}   | ${"Pacific/Chatham"}     | ${""}                                               | ${"a 45-minute-offset zone's gap"}
      ${"2024-09-09T18:00:00-03:00[America/Santiago]"}    | ${"P1D"}  | ${"00:00"}   | ${"America/Santiago"}    | ${""}                                               | ${"Santiago skipped its midnight"}
      ${"2011-12-31T12:00:00+14:00[Pacific/Apia]"}        | ${"P1D"}  | ${"17:00"}   | ${"Pacific/Apia"}        | ${""}                                               | ${"Samoa deleted 30 December"}
      ${"2011-12-31T12:00:00+14:00[Pacific/Apia]"}        | ${"P1D"}  | ${undefined} | ${"Pacific/Apia"}        | ${""}                                               | ${"the deleted day, unpinned"}
    `("$why", ({ anchor, offset, atLocalTime, timeZone, expected }) => {
      expect(cutoffAt(anchor, offset, { timeZone, atLocalTime })).toBe(
        expected,
      );
    });
  });

  describe("offset arithmetic", () => {
    it.each`
      anchor                                           | offset                | atLocalTime     | timeZone              | expected                                                   | why
      ${"2024-03-31T12:00:00Z"}                        | ${"P1M"}              | ${undefined}    | ${"UTC"}              | ${"2024-02-29T12:00:00+00:00[UTC]"}                        | ${"a month back from 31 March clamps to 29 February"}
      ${departure}                                     | ${"P1W"}              | ${"17:00"}      | ${amsterdam}          | ${"2024-06-07T17:00:00+02:00[Europe/Amsterdam]"}           | ${"a week"}
      ${departure}                                     | ${"P1W"}              | ${undefined}    | ${amsterdam}          | ${"2024-06-07T18:00:00+02:00[Europe/Amsterdam]"}           | ${"a week keeps the wall clock"}
      ${"2024-03-31T12:00:00Z"}                        | ${"P1M"}              | ${"17:00"}      | ${"UTC"}              | ${"2024-02-29T17:00:00+00:00[UTC]"}                        | ${"a pinned month back from 31 March clamps to 29 February"}
      ${"2024-06-14T00:00:00Z"}                        | ${"P2D"}              | ${"17:00"}      | ${"UTC"}              | ${"2024-06-12T17:00:00+00:00[UTC]"}                        | ${"two days before midnight, pinned"}
      ${"2024-06-14T00:00:00Z"}                        | ${"P2DT0.000000001S"} | ${"17:00"}      | ${"UTC"}              | ${"2024-06-11T17:00:00+00:00[UTC]"}                        | ${"one nanosecond of exact offset crosses midnight first, so the day moves"}
      ${departure}                                     | ${"P1DT12H"}          | ${"17:00"}      | ${amsterdam}          | ${"2024-06-13T17:00:00+02:00[Europe/Amsterdam]"}           | ${"12 hours to Friday 06:00, then a day"}
      ${departure}                                     | ${"P1DT12H"}          | ${undefined}    | ${amsterdam}          | ${"2024-06-13T06:00:00+02:00[Europe/Amsterdam]"}           | ${"a day, then 12 exact hours"}
      ${departure}                                     | ${"-P1D"}             | ${"17:00"}      | ${amsterdam}          | ${"2024-06-15T17:00:00+02:00[Europe/Amsterdam]"}           | ${"a negative offset is after the anchor"}
      ${departure}                                     | ${"PT0S"}             | ${undefined}    | ${amsterdam}          | ${"2024-06-14T18:00:00+02:00[Europe/Amsterdam]"}           | ${"a zero offset is the anchor"}
      ${departure}                                     | ${"P0D"}              | ${"12:00"}      | ${amsterdam}          | ${"2024-06-14T12:00:00+02:00[Europe/Amsterdam]"}           | ${"noon on the day of departure"}
      ${departure}                                     | ${"PT24H"}            | ${"17:00"}      | ${amsterdam}          | ${"2024-06-13T17:00:00+02:00[Europe/Amsterdam]"}           | ${"an exact offset, pinned"}
      ${"2024-06-14T16:00:00.123456789Z"}              | ${"PT1H"}             | ${undefined}    | ${amsterdam}          | ${"2024-06-14T17:00:00.123456789+02:00[Europe/Amsterdam]"} | ${"nanoseconds survive"}
      ${departure}                                     | ${"P2D"}              | ${"17:00:30.5"} | ${amsterdam}          | ${"2024-06-12T17:00:30.5+02:00[Europe/Amsterdam]"}         | ${"a fractional atLocalTime"}
      ${departure}                                     | ${"P2D"}              | ${"17:00"}      | ${"+02:00"}           | ${"2024-06-12T17:00:00+02:00[+02:00]"}                     | ${"a fixed offset observes no DST"}
      ${departure}                                     | ${"P2D"}              | ${"17:00"}      | ${"europe/amsterdam"} | ${"2024-06-12T17:00:00+02:00[Europe/Amsterdam]"}           | ${"the zone is canonicalised"}
      ${"2024-06-14T18:00:00+02:00[Europe/Amsterdam]"} | ${"P2D"}              | ${"17:00"}      | ${"UTC"}              | ${"2024-06-12T17:00:00+00:00[UTC]"}                        | ${"timeZone, not the anchor's bracket, is the local frame"}
    `("$why", ({ anchor, offset, atLocalTime, timeZone, expected }) => {
      expect(cutoffAt(anchor, offset, { timeZone, atLocalTime })).toBe(
        expected,
      );
    });
  });

  // Local 18:00 on Friday 14 June 2024 in every battle-test zone: the document cut-off is
  // 17:00 local on Wednesday 12 June in that zone, whatever its offset.
  it.each(battleTestTimeZones)(
    "pins the document cut-off to Wednesday 17:00 on %s's own clock",
    (timeZone) => {
      const anchor = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 6,
        day: 14,
        hour: 18,
        timeZone,
      });
      const expected = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 6,
        day: 12,
        hour: 17,
        timeZone,
      });
      const result = cutoffAt(anchor.toInstant().toString(), "P2D", {
        timeZone,
        atLocalTime: "17:00",
      });
      expect(result).toBe(expected.toString());
      expect(
        Temporal.ZonedDateTime.compare(
          Temporal.ZonedDateTime.from(result),
          anchor,
        ),
      ).toBe(-1);
    },
  );

  it.each(battleTestTimeZones)(
    "an exact offset is the same instant in every zone (%s)",
    (timeZone) => {
      const result = cutoffAt(departure, "PT24H", { timeZone });
      expect(Temporal.Instant.from(result).toString()).toBe(
        "2024-06-13T16:00:00Z",
      );
    },
  );

  // The 1844 date-line crossings: noon on 1 January 1845 is 24 elapsed hours after noon on
  // 30 December, because 31 December never happened. `dateLineCrossingAt` builds both from
  // exact time, so the expected values resolve no wall clock.
  it.each(dateLineCrossingTimeZones)(
    "never lands on the deleted 1844-12-31 in $timeZone",
    (crossing) => {
      const anchor = dateLineCrossingAt(crossing, 36).toInstant().toString();
      const timeZone = crossing.timeZone;
      const thirtieth = dateLineCrossingAt(crossing, -12).toString();
      expect(cutoffAt(anchor, "P1D", { timeZone, atLocalTime: "12:00" })).toBe(
        dateLineCrossingAt(crossing, 12).toString(),
      );
      expect(cutoffAt(anchor, "P2D", { timeZone, atLocalTime: "12:00" })).toBe(
        "",
      );
      expect(cutoffAt(anchor, "P3D", { timeZone, atLocalTime: "12:00" })).toBe(
        thirtieth,
      );
      expect(cutoffAt(anchor, "P2D", { timeZone })).toBe("");
      expect(cutoffAt(anchor, "PT48H", { timeZone })).toBe(thirtieth);
    },
  );

  describe("invalid input returns the sentinel", () => {
    it.each`
      anchor                       | offset        | options                                                                                                                                              | why
      ${"2024-06-14T18:00:00"}     | ${"P2D"}      | ${{ timeZone: amsterdam }}                                                                                                                           | ${"a zoneless anchor is not a moment"}
      ${"not a date"}              | ${"P2D"}      | ${{ timeZone: amsterdam }}                                                                                                                           | ${"a malformed anchor"}
      ${departure}                 | ${"2 days"}   | ${{ timeZone: amsterdam }}                                                                                                                           | ${"a malformed offset"}
      ${departure}                 | ${"P2D"}      | ${{ timeZone: "Europe/Amsterdamm" }}                                                                                                                 | ${"an unknown zone"}
      ${departure}                 | ${"P2D"}      | ${{}}                                                                                                                                                | ${"no zone"}
      ${departure}                 | ${"P2D"}      | ${undefined}                                                                                                                                         | ${"no options"}
      ${departure}                 | ${"P2D"}      | ${null}                                                                                                                                              | ${"null options"}
      ${departure}                 | ${"P2D"}      | ${"Europe/Amsterdam"}                                                                                                                                | ${"a string for options"}
      ${departure}                 | ${"P2D"}      | ${{ timeZone: amsterdam, atLocalTime: "5pm" }}                                                                                                       | ${"a malformed atLocalTime"}
      ${departure}                 | ${"P2D"}      | ${{ timeZone: amsterdam, atLocalTime: "T17:00" }}                                                                                                    | ${"a time designator"}
      ${departure}                 | ${"P2D"}      | ${{ timeZone: amsterdam, atLocalTime: "24:00" }}                                                                                                     | ${"hour 24"}
      ${departure}                 | ${"P2D"}      | ${{ timeZone: amsterdam, atLocalTime: "2024-06-12T17:00" }}                                                                                          | ${"a date-time for atLocalTime"}
      ${departure}                 | ${"P2D"}      | ${{ timeZone: amsterdam, calendar: { weekend: [8], holidays: [], timeZone: amsterdam } }}                                                            | ${"an invalid calendar"}
      ${departure}                 | ${"P2D"}      | ${{ timeZone: amsterdam, calendar: weekdays, roll: "nearest" }}                                                                                      | ${"an unknown roll convention"}
      ${departure}                 | ${"P2D"}      | ${{ timeZone: amsterdam, roll: "preceding" }}                                                                                                        | ${"a roll with no calendar to roll against"}
      ${departure}                 | ${"P2D"}      | ${{ timeZone: amsterdam, calendar: weekdays }}                                                                                                       | ${"a calendar with no roll convention"}
      ${departure}                 | ${"P2D"}      | ${{ timeZone: amsterdam, calendar: { weekend: [1, 2, 3, 4, 5, 6, 7], holidays: [], timeZone: amsterdam }, roll: "preceding" }}                       | ${"a calendar with no business day at all"}
      ${departure}                 | ${"P2D"}      | ${{ timeZone: amsterdam, atLocalTime: "17:00", calendar: { weekend: [1, 2, 3, 4, 5, 6, 7], holidays: [], timeZone: amsterdam }, roll: "preceding" }} | ${"a pinned cut-off against a calendar with no business day"}
      ${departure}                 | ${"P300000Y"} | ${{ timeZone: amsterdam }}                                                                                                                           | ${"an offset past the instant range"}
      ${departure}                 | ${"P300000Y"} | ${{ timeZone: amsterdam, atLocalTime: "17:00" }}                                                                                                     | ${"a pinned offset past the instant range"}
      ${"-271821-04-20T00:00:00Z"} | ${"PT1H"}     | ${{ timeZone: "UTC" }}                                                                                                                               | ${"an exact offset before the first instant"}
    `("$why", ({ anchor, offset, options }) => {
      expect(cutoffAt(anchor, offset, options)).toBe("");
    });

    it("returns the sentinel when the instant parse throws", () => {
      mockTemporalInstantFromThrow();
      expect(cutoffAt(departure, "P2D", { timeZone: amsterdam })).toBe("");
    });
  });
});
