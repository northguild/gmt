import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { recurringWindows } from "./recurringWindows";

const nineToFive = [{ from: "09:00", to: "17:00" }];
const weekdays = {
  1: nineToFive,
  2: nineToFive,
  3: nineToFive,
  4: nineToFive,
  5: nineToFive,
};
/** Monday 10 June to Monday 17 June 2024, New York midnight to midnight (EDT, UTC−4). */
const juneWeek = {
  start: "2024-06-10T04:00:00Z",
  end: "2024-06-17T04:00:00Z",
};
const allDay = [{ from: "00:00", to: "00:00" }];

/** A local wall time in `timeZone`, resolved by Temporal itself ("compatible"). */
function local(dateTime: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(dateTime)
    .toZonedDateTime(timeZone)
    .toInstant()
    .toString();
}

function hoursOf(interval: { start: string; end: string }): string {
  return Temporal.Instant.from(interval.start)
    .until(Temporal.Instant.from(interval.end), { largestUnit: "hours" })
    .toString();
}

describe("recurringWindows", () => {
  it("yields five eight-hour intervals for a Monday–Friday 09:00–17:00 week", () => {
    expect(recurringWindows(weekdays, juneWeek, "America/New_York")).toEqual([
      { start: "2024-06-10T13:00:00Z", end: "2024-06-10T21:00:00Z" },
      { start: "2024-06-11T13:00:00Z", end: "2024-06-11T21:00:00Z" },
      { start: "2024-06-12T13:00:00Z", end: "2024-06-12T21:00:00Z" },
      { start: "2024-06-13T13:00:00Z", end: "2024-06-13T21:00:00Z" },
      { start: "2024-06-14T13:00:00Z", end: "2024-06-14T21:00:00Z" },
    ]);
  });

  describe("midnight wrap", () => {
    const fridayNight = { 5: [{ from: "23:00", to: "06:00" }] };

    it("attributes a 23:00–06:00 window to the weekday it starts on, seven hours long", () => {
      const result = recurringWindows(fridayNight, juneWeek, "UTC");
      expect(result).toEqual([
        { start: "2024-06-14T23:00:00Z", end: "2024-06-15T06:00:00Z" },
      ]);
      expect(hoursOf(result[0])).toBe("PT7H");
    });

    it("does not read a wrap listed under Saturday as Friday night", () => {
      expect(
        recurringWindows(
          { 6: [{ from: "23:00", to: "06:00" }] },
          { start: "2024-06-14T00:00:00Z", end: "2024-06-15T12:00:00Z" },
          "UTC",
        ),
      ).toEqual([]);
    });

    it("reaches back to the previous date for a range that starts inside its wrap", () => {
      expect(
        recurringWindows(
          fridayNight,
          { start: "2024-06-15T01:00:00Z", end: "2024-06-15T12:00:00Z" },
          "UTC",
        ),
      ).toEqual([
        { start: "2024-06-15T01:00:00Z", end: "2024-06-15T06:00:00Z" },
      ]);
    });

    it.each`
      from       | to         | expected
      ${"00:00"} | ${"00:00"} | ${"PT24H"}
      ${"09:00"} | ${"09:00"} | ${"PT24H"}
      ${"17:00"} | ${"09:00"} | ${"PT16H"}
      ${"09:00"} | ${"08:59"} | ${"PT23H59M"}
    `(
      "treats $from–$to as wrapping past midnight ($expected)",
      ({ from, to, expected }) => {
        const result = recurringWindows(
          { 1: [{ from, to }] },
          { start: "2024-06-10T00:00:00Z", end: "2024-06-12T00:00:00Z" },
          "UTC",
        );
        expect(result).toHaveLength(1);
        expect(hoursOf(result[0])).toBe(expected);
      },
    );
  });

  describe("merging", () => {
    it("merges whole days that touch at midnight into one interval", () => {
      expect(
        recurringWindows(
          { 1: allDay, 2: allDay, 3: allDay },
          { start: "2024-06-09T00:00:00Z", end: "2024-06-16T00:00:00Z" },
          "UTC",
        ),
      ).toEqual([
        { start: "2024-06-10T00:00:00Z", end: "2024-06-13T00:00:00Z" },
      ]);
    });

    it("merges overlapping and touching windows of one day, in any order", () => {
      expect(
        recurringWindows(
          {
            1: [
              { from: "13:00", to: "17:00" },
              { from: "09:00", to: "12:00" },
              { from: "11:00", to: "13:00" },
              { from: "18:00", to: "19:00" },
            ],
          },
          { start: "2024-06-10T00:00:00Z", end: "2024-06-11T00:00:00Z" },
          "UTC",
        ),
      ).toEqual([
        { start: "2024-06-10T09:00:00Z", end: "2024-06-10T17:00:00Z" },
        { start: "2024-06-10T18:00:00Z", end: "2024-06-10T19:00:00Z" },
      ]);
    });

    it("merges a night window into the next morning's window", () => {
      expect(
        recurringWindows(
          {
            5: [{ from: "22:00", to: "06:00" }],
            6: [{ from: "05:00", to: "08:00" }],
          },
          { start: "2024-06-14T00:00:00Z", end: "2024-06-16T00:00:00Z" },
          "UTC",
        ),
      ).toEqual([
        { start: "2024-06-14T22:00:00Z", end: "2024-06-15T08:00:00Z" },
      ]);
    });
  });

  describe("clipping to the range", () => {
    it("clips at both ends, echoing the range's own strings", () => {
      expect(
        recurringWindows(
          weekdays,
          {
            start: "2024-06-10T10:00:00-04:00",
            end: "2024-06-11T12:00:00-04:00",
          },
          "America/New_York",
        ),
      ).toEqual([
        { start: "2024-06-10T10:00:00-04:00", end: "2024-06-10T21:00:00Z" },
        { start: "2024-06-11T13:00:00Z", end: "2024-06-11T12:00:00-04:00" },
      ]);
    });

    it("excludes a window that only touches the range (half-open)", () => {
      expect(
        recurringWindows(
          weekdays,
          { start: "2024-06-10T21:00:00Z", end: "2024-06-11T13:00:00Z" },
          "America/New_York",
        ),
      ).toEqual([]);
    });

    it.each`
      range                                                             | reads
      ${{ start: "2024-06-10T14:00:00Z", end: "2024-06-10T14:00:00Z" }} | ${"an empty range inside a window"}
      ${{ start: "2024-06-15T00:00:00Z", end: "2024-06-17T04:00:00Z" }} | ${"a closed weekend"}
    `("returns [] for $reads", ({ range }) => {
      expect(recurringWindows(weekdays, range, "America/New_York")).toEqual([]);
    });

    it("returns [] for an empty weekly pattern", () => {
      expect(recurringWindows({}, juneWeek, "America/New_York")).toEqual([]);
    });

    it("reads undefined and [] weekdays as closed", () => {
      expect(
        recurringWindows(
          { 1: undefined, 2: [], 3: nineToFive },
          juneWeek,
          "America/New_York",
        ),
      ).toEqual([
        { start: "2024-06-12T13:00:00Z", end: "2024-06-12T21:00:00Z" },
      ]);
    });
  });

  describe("transition nights (America/New_York)", () => {
    // Derived from the wall clock: 23:00 EDT is 03:00Z; 06:00 EST is 11:00Z. Checked against the polyfill.
    it.each`
      weekly                                     | range                                                             | start                     | end                       | length
      ${{ 6: [{ from: "23:00", to: "06:00" }] }} | ${{ start: "2024-11-02T00:00:00Z", end: "2024-11-04T00:00:00Z" }} | ${"2024-11-03T03:00:00Z"} | ${"2024-11-03T11:00:00Z"} | ${"PT8H"}
      ${{ 7: allDay }}                           | ${{ start: "2024-11-03T00:00:00Z", end: "2024-11-05T00:00:00Z" }} | ${"2024-11-03T04:00:00Z"} | ${"2024-11-04T05:00:00Z"} | ${"PT25H"}
      ${{ 6: [{ from: "23:00", to: "06:00" }] }} | ${{ start: "2024-03-09T00:00:00Z", end: "2024-03-11T00:00:00Z" }} | ${"2024-03-10T04:00:00Z"} | ${"2024-03-10T10:00:00Z"} | ${"PT6H"}
      ${{ 7: allDay }}                           | ${{ start: "2024-03-10T00:00:00Z", end: "2024-03-12T00:00:00Z" }} | ${"2024-03-10T05:00:00Z"} | ${"2024-03-11T04:00:00Z"} | ${"PT23H"}
    `(
      "is $length from $start (elapsed time, not wall-clock length)",
      ({ weekly, range, start, end, length }) => {
        const result = recurringWindows(weekly, range, "America/New_York");
        expect(result).toEqual([{ start, end }]);
        expect(hoursOf(result[0])).toBe(length);
      },
    );

    // 02:30 on 10 March does not exist; 01:30 on 3 November happens twice.
    it.each`
      disambiguation  | date            | from       | to         | expected
      ${undefined}    | ${"2024-03-10"} | ${"02:30"} | ${"04:00"} | ${[{ start: "2024-03-10T07:30:00Z", end: "2024-03-10T08:00:00Z" }]}
      ${"compatible"} | ${"2024-03-10"} | ${"02:30"} | ${"04:00"} | ${[{ start: "2024-03-10T07:30:00Z", end: "2024-03-10T08:00:00Z" }]}
      ${"later"}      | ${"2024-03-10"} | ${"02:30"} | ${"04:00"} | ${[{ start: "2024-03-10T07:30:00Z", end: "2024-03-10T08:00:00Z" }]}
      ${"earlier"}    | ${"2024-03-10"} | ${"02:30"} | ${"04:00"} | ${[{ start: "2024-03-10T06:30:00Z", end: "2024-03-10T08:00:00Z" }]}
      ${"reject"}     | ${"2024-03-10"} | ${"02:30"} | ${"04:00"} | ${[]}
      ${undefined}    | ${"2024-11-03"} | ${"01:30"} | ${"03:00"} | ${[{ start: "2024-11-03T05:30:00Z", end: "2024-11-03T08:00:00Z" }]}
      ${"compatible"} | ${"2024-11-03"} | ${"01:30"} | ${"03:00"} | ${[{ start: "2024-11-03T05:30:00Z", end: "2024-11-03T08:00:00Z" }]}
      ${"earlier"}    | ${"2024-11-03"} | ${"01:30"} | ${"03:00"} | ${[{ start: "2024-11-03T05:30:00Z", end: "2024-11-03T08:00:00Z" }]}
      ${"later"}      | ${"2024-11-03"} | ${"01:30"} | ${"03:00"} | ${[{ start: "2024-11-03T06:30:00Z", end: "2024-11-03T08:00:00Z" }]}
      ${"reject"}     | ${"2024-11-03"} | ${"01:30"} | ${"03:00"} | ${[]}
    `(
      "resolves a $from edge on $date under $disambiguation",
      ({ disambiguation, date, from, to, expected }) => {
        const range = {
          start: `${date}T00:00:00Z`,
          end: Temporal.PlainDate.from(date)
            .add({ days: 1 })
            .toString()
            .concat("T00:00:00Z"),
        };
        expect(
          recurringWindows({ 7: [{ from, to }] }, range, "America/New_York", {
            disambiguation,
          }),
        ).toEqual(expected);
      },
    );

    it.each(["compatible", "earlier", "later", "reject"])(
      "has no effect under %s on an ordinary date",
      (disambiguation) => {
        expect(
          recurringWindows(weekdays, juneWeek, "America/New_York", {
            disambiguation: disambiguation as "compatible",
          }),
        ).toEqual(recurringWindows(weekdays, juneWeek, "America/New_York"));
      },
    );

    // Sunday 10 March: 02:30 does not exist, so under "reject" that window could span anything
    // from 01:30 EST (06:30Z) to 04:00 EDT (08:00Z). A range it cannot reach is answered.
    const twoSundayWindows = {
      7: [
        { from: "02:30", to: "04:00" },
        { from: "12:00", to: "13:00" },
      ],
    };

    it.each`
      range                                                             | expected                                                            | reads
      ${{ start: "2024-03-10T08:00:00Z", end: "2024-03-10T20:00:00Z" }} | ${[{ start: "2024-03-10T16:00:00Z", end: "2024-03-10T17:00:00Z" }]} | ${"a range starting where the rejected window's widest span ends"}
      ${{ start: "2024-03-10T07:59:59Z", end: "2024-03-10T20:00:00Z" }} | ${[]}                                                               | ${"a range reaching one second into it"}
    `(
      "under reject, answers only when no rejected window reaches the range: $reads",
      ({ range, expected }) => {
        expect(
          recurringWindows(twoSundayWindows, range, "America/New_York", {
            disambiguation: "reject",
          }),
        ).toEqual(expected);
      },
    );

    it("under reject, returns [] for a range touching a rejected window even when others are open in it", () => {
      expect(
        recurringWindows(
          {
            6: [{ from: "20:00", to: "01:00" }],
            7: [{ from: "02:30", to: "04:00" }],
          },
          { start: "2024-03-10T00:00:00Z", end: "2024-03-10T07:00:00Z" },
          "America/New_York",
          { disambiguation: "reject" },
        ),
      ).toEqual([]);
      // The same range stopping before the rejected window's widest span is answered.
      expect(
        recurringWindows(
          {
            6: [{ from: "20:00", to: "01:00" }],
            7: [{ from: "02:30", to: "04:00" }],
          },
          { start: "2024-03-10T00:00:00Z", end: "2024-03-10T06:30:00Z" },
          "America/New_York",
          { disambiguation: "reject" },
        ),
      ).toEqual([
        { start: "2024-03-10T01:00:00Z", end: "2024-03-10T06:00:00Z" },
      ]);
    });
  });

  describe("probe zones", () => {
    it.each`
      zone                     | weekly                                     | range                                                             | expected
      ${"Pacific/Apia"}        | ${{ 4: [{ from: "23:00", to: "06:00" }] }} | ${{ start: "2011-12-29T00:00:00Z", end: "2012-01-02T00:00:00Z" }} | ${[{ start: "2011-12-30T09:00:00Z", end: "2011-12-30T16:00:00Z" }]}
      ${"Pacific/Apia"}        | ${{ 5: nineToFive }}                       | ${{ start: "2011-12-28T00:00:00Z", end: "2012-01-02T00:00:00Z" }} | ${[]}
      ${"America/Santiago"}    | ${{ 7: allDay }}                           | ${{ start: "2024-09-08T00:00:00Z", end: "2024-09-10T00:00:00Z" }} | ${[{ start: "2024-09-08T04:00:00Z", end: "2024-09-09T03:00:00Z" }]}
      ${"America/Havana"}      | ${{ 7: [{ from: "00:00", to: "06:00" }] }} | ${{ start: "2024-11-03T00:00:00Z", end: "2024-11-04T00:00:00Z" }} | ${[{ start: "2024-11-03T04:00:00Z", end: "2024-11-03T11:00:00Z" }]}
      ${"America/Goose_Bay"}   | ${{ 6: [{ from: "23:30", to: "00:30" }] }} | ${{ start: "2010-11-06T00:00:00Z", end: "2010-11-08T00:00:00Z" }} | ${[{ start: "2010-11-07T02:30:00Z", end: "2010-11-07T04:30:00Z" }]}
      ${"America/Goose_Bay"}   | ${{ 6: [{ from: "22:00", to: "23:00" }] }} | ${{ start: "2010-11-06T00:00:00Z", end: "2010-11-08T00:00:00Z" }} | ${[{ start: "2010-11-07T01:00:00Z", end: "2010-11-07T02:00:00Z" }]}
      ${"Pacific/Chatham"}     | ${{ 7: [{ from: "02:00", to: "05:00" }] }} | ${{ start: "2024-09-28T00:00:00Z", end: "2024-09-29T00:00:00Z" }} | ${[{ start: "2024-09-28T13:15:00Z", end: "2024-09-28T15:15:00Z" }]}
      ${"Pacific/Chatham"}     | ${{ 7: [{ from: "03:00", to: "04:00" }] }} | ${{ start: "2024-09-28T00:00:00Z", end: "2024-09-29T00:00:00Z" }} | ${[]}
      ${"Pacific/Chatham"}     | ${{ 7: allDay }}                           | ${{ start: "2024-04-06T00:00:00Z", end: "2024-04-08T00:00:00Z" }} | ${[{ start: "2024-04-06T10:15:00Z", end: "2024-04-07T11:15:00Z" }]}
      ${"Australia/Lord_Howe"} | ${{ 7: allDay }}                           | ${{ start: "2024-04-06T00:00:00Z", end: "2024-04-08T00:00:00Z" }} | ${[{ start: "2024-04-06T13:00:00Z", end: "2024-04-07T13:30:00Z" }]}
      ${"Australia/Lord_Howe"} | ${{ 7: allDay }}                           | ${{ start: "2024-10-05T00:00:00Z", end: "2024-10-07T00:00:00Z" }} | ${[{ start: "2024-10-05T13:30:00Z", end: "2024-10-06T13:00:00Z" }]}
      ${"Antarctica/Casey"}    | ${{ 7: [{ from: "00:00", to: "04:00" }] }} | ${{ start: "2020-10-03T00:00:00Z", end: "2020-10-05T00:00:00Z" }} | ${[{ start: "2020-10-03T16:00:00Z", end: "2020-10-03T17:00:00Z" }]}
    `(
      "resolves $weekly in $zone to $expected",
      ({ zone, weekly, range, expected }) => {
        // Apia: Thursday 23:00 (−10:00) runs to Saturday 06:00 (+14:00), seven real hours; the deleted
        // Friday has no window. Santiago skips 00:00, so the day opens at 01:00 and is 23 hours.
        // Havana repeats midnight; "compatible" takes the first. Goose Bay's re-entered Saturday is
        // walked once. Chatham's 03:00 edge moves an hour forward onto its own 04:00, leaving the
        // window empty. Casey's clock reads 00:00–00:01 and 03:01–04:00: one hour.
        expect(recurringWindows(weekly, range, zone)).toEqual(expected);
      },
    );
  });

  it("reads windows in a fixed-offset zone, which observes no DST", () => {
    expect(
      recurringWindows(
        { 7: [{ from: "00:00", to: "00:00" }] },
        { start: "2024-11-03T00:00:00Z", end: "2024-11-05T00:00:00Z" },
        "-05:00",
      ),
    ).toEqual([{ start: "2024-11-03T05:00:00Z", end: "2024-11-04T05:00:00Z" }]);
  });

  describe("battle-test time zones", () => {
    it.each(battleTestTimeZones)(
      "places each weekday window at 09:00–17:00 local in %s",
      (timeZone) => {
        const range = {
          start: local("2024-06-10T00:00", timeZone),
          end: local("2024-06-17T00:00", timeZone),
        };
        const expected = [10, 11, 12, 13, 14].map((day) => ({
          start: local(`2024-06-${day}T09:00`, timeZone),
          end: local(`2024-06-${day}T17:00`, timeZone),
        }));
        expect(recurringWindows(weekdays, range, timeZone)).toEqual(expected);
      },
    );
  });

  describe("invalid input", () => {
    const day = { start: "2024-06-10T00:00:00Z", end: "2024-06-11T00:00:00Z" };

    it.each`
      weekly                                                | reads
      ${{ 0: nineToFive }}                                  | ${"weekday 0"}
      ${{ 8: nineToFive }}                                  | ${"weekday 8"}
      ${{ Mon: nineToFive }}                                | ${"a weekday name"}
      ${{ 1: [{ from: "09:00" }] }}                         | ${"a window without to"}
      ${{ 1: [{ from: "9:00", to: "17:00" }] }}             | ${"a one-digit hour"}
      ${{ 1: [{ from: "09:00", to: "24:00" }] }}            | ${"24:00"}
      ${{ 1: [{ from: "T09:00", to: "17:00" }] }}           | ${"a time designator"}
      ${{ 1: [{ from: "2024-06-10T09:00", to: "17:00" }] }} | ${"a date-time"}
      ${{ 1: [{ from: 9, to: 17 }] }}                       | ${"numbers"}
      ${{ 1: [null] }}                                      | ${"a null window"}
      ${{ 1: { from: "09:00", to: "17:00" } }}              | ${"a window that is not in an array"}
      ${null}                                               | ${"null"}
      ${[nineToFive]}                                       | ${"an array"}
      ${"weekdays"}                                         | ${"a string"}
    `("returns [] for $reads", ({ weekly }) => {
      expect(recurringWindows(weekly, day, "UTC")).toEqual([]);
    });

    it.each`
      range                                                             | timeZone          | options                          | reads
      ${{ start: "2024-06-11T00:00:00Z", end: "2024-06-10T00:00:00Z" }} | ${"UTC"}          | ${undefined}                     | ${"an inverted range"}
      ${{ start: "2024-06-10T00:00:00", end: "2024-06-11T00:00:00Z" }}  | ${"UTC"}          | ${undefined}                     | ${"a range endpoint without an offset"}
      ${null}                                                           | ${"UTC"}          | ${undefined}                     | ${"a null range"}
      ${day}                                                            | ${"Invalid/Zone"} | ${undefined}                     | ${"an invalid zone"}
      ${day}                                                            | ${""}             | ${undefined}                     | ${"an empty zone"}
      ${day}                                                            | ${"UTC"}          | ${{ disambiguation: "nearest" }} | ${"an unknown disambiguation"}
      ${day}                                                            | ${"UTC"}          | ${null}                          | ${"null options"}
      ${day}                                                            | ${"UTC"}          | ${"reject"}                      | ${"a string options argument"}
    `("returns [] for $reads", ({ range, timeZone, options }) => {
      expect(
        recurringWindows({ 1: nineToFive }, range, timeZone, options),
      ).toEqual([]);
    });

    it("returns [] for a range longer than 10,000 local days rather than a truncated list", () => {
      expect(
        recurringWindows(
          { 1: nineToFive },
          { start: "2000-01-01T00:00:00Z", end: "2030-01-01T00:00:00Z" },
          "UTC",
        ),
      ).toEqual([]);
    });

    it("returns [] rather than throwing for hostile arguments", () => {
      expect(recurringWindows(hostileProxy() as never, day, "UTC")).toEqual([]);
      expect(recurringWindows(revokedProxy() as never, day, "UTC")).toEqual([]);
      expect(
        recurringWindows({ 1: nineToFive }, hostileProxy() as never, "UTC"),
      ).toEqual([]);
      expect(
        recurringWindows({ 1: [hostileProxy()] } as never, day, "UTC"),
      ).toEqual([]);
    });
  });
});

describe("recurringWindows when Temporal throws", () => {
  it.each`
    mock                                            | reads
    ${mockTemporalPlainTimeFromThrow}               | ${"reading a window"}
    ${mockTemporalInstantFromEpochNanosecondsThrow} | ${"walking the local days"}
  `("returns the sentinel when $reads throws", ({ mock }) => {
    mock();
    expect(
      recurringWindows(
        { 1: [{ from: "09:00", to: "17:00" }] },
        { start: "2024-06-10T00:00:00Z", end: "2024-06-11T00:00:00Z" },
        "America/New_York",
      ),
    ).toEqual([]);
  });
});
