import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { operatingIntervals } from "./operatingIntervals";
import { recurringWindows } from "./recurringWindows";

const nineToFive = [{ from: "09:00", to: "17:00" }];
const weekdays = {
  1: nineToFive,
  2: nineToFive,
  3: nineToFive,
  4: nineToFive,
  5: nineToFive,
};
/** Monday 1 July to Monday 8 July 2024, New York midnight to midnight (EDT, UTC−4). */
const julyWeek = {
  start: "2024-07-01T04:00:00Z",
  end: "2024-07-08T04:00:00Z",
};
/** Friday 14 June to Sunday 16 June 2024, UTC. */
const juneWeekend = {
  start: "2024-06-14T00:00:00Z",
  end: "2024-06-16T00:00:00Z",
};
const fridayNight = { 5: [{ from: "23:00", to: "06:00" }] };

// Cairo skipped local midnight on Friday 2024-04-26 (00:00 → 01:00, +02 → +03), and Santiago on
// Sunday 2024-09-08 (-04 → -03). Under "earlier" a 00:30 edge in the gap moves back an hour, onto
// the previous date: Cairo's to 23:30 +02 (21:30Z), half an hour before Friday's first instant.
const cairo = {
  timeZone: "Africa/Cairo",
  weekly: {
    4: [{ from: "22:00", to: "23:45" }],
    5: [{ from: "00:30", to: "03:00" }],
  },
};

function local(dateTime: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(dateTime)
    .toZonedDateTime(timeZone)
    .toInstant()
    .toString();
}

describe("operatingIntervals", () => {
  it("drops a holiday and replaces an overridden date's windows with the override's", () => {
    expect(
      operatingIntervals(
        {
          timeZone: "America/New_York",
          weekly: weekdays,
          holidays: ["2024-07-04"],
          overrides: [
            { date: "2024-07-05", windows: [{ from: "10:00", to: "12:00" }] },
          ],
        },
        julyWeek,
      ),
    ).toEqual([
      { start: "2024-07-01T13:00:00Z", end: "2024-07-01T21:00:00Z" },
      { start: "2024-07-02T13:00:00Z", end: "2024-07-02T21:00:00Z" },
      { start: "2024-07-03T13:00:00Z", end: "2024-07-03T21:00:00Z" },
      { start: "2024-07-05T14:00:00Z", end: "2024-07-05T16:00:00Z" },
    ]);
  });

  it("equals recurringWindows when there are no holidays or overrides", () => {
    expect(
      operatingIntervals(
        { timeZone: "America/New_York", weekly: weekdays },
        julyWeek,
      ),
    ).toEqual(recurringWindows(weekdays, julyWeek, "America/New_York"));
  });

  describe("holidays and overrides", () => {
    it.each`
      holidays          | overrides                                                              | expected                                                                                                                            | reads
      ${["2024-06-14"]} | ${undefined}                                                           | ${[]}                                                                                                                               | ${"a Friday holiday removes Friday's night window"}
      ${["2024-06-15"]} | ${undefined}                                                           | ${[{ start: "2024-06-14T23:00:00Z", end: "2024-06-15T06:00:00Z" }]}                                                                 | ${"a Saturday holiday leaves Friday's night window alone"}
      ${undefined}      | ${[{ date: "2024-06-14", windows: [{ from: "20:00", to: "22:00" }] }]} | ${[{ start: "2024-06-14T20:00:00Z", end: "2024-06-14T22:00:00Z" }]}                                                                 | ${"a Friday override replaces the night window entirely"}
      ${undefined}      | ${[{ date: "2024-06-14", windows: [] }]}                               | ${[]}                                                                                                                               | ${"an empty override closes the day"}
      ${undefined}      | ${[{ date: "2024-06-15", windows: [{ from: "10:00", to: "11:00" }] }]} | ${[{ start: "2024-06-14T23:00:00Z", end: "2024-06-15T06:00:00Z" }, { start: "2024-06-15T10:00:00Z", end: "2024-06-15T11:00:00Z" }]} | ${"an override opens a day the week leaves closed"}
      ${["2024-06-14"]} | ${[{ date: "2024-06-14", windows: [{ from: "23:00", to: "01:00" }] }]} | ${[{ start: "2024-06-14T23:00:00Z", end: "2024-06-15T01:00:00Z" }]}                                                                 | ${"an override wins over a holiday on the same date"}
      ${[]}             | ${[]}                                                                  | ${[{ start: "2024-06-14T23:00:00Z", end: "2024-06-15T06:00:00Z" }]}                                                                 | ${"empty lists change nothing"}
    `("$reads", ({ holidays, overrides, expected }) => {
      expect(
        operatingIntervals(
          { timeZone: "UTC", weekly: fridayNight, holidays, overrides },
          juneWeekend,
        ),
      ).toEqual(expected);
    });

    it("reads holiday and override dates in the schedule's zone, not in UTC", () => {
      // 2024-07-04 in Tokyo runs from 2024-07-03T15:00Z; its 09:00 window is 00:00Z.
      expect(
        operatingIntervals(
          {
            timeZone: "Asia/Tokyo",
            weekly: weekdays,
            holidays: ["2024-07-04"],
          },
          { start: "2024-07-03T12:00:00Z", end: "2024-07-05T12:00:00Z" },
        ),
      ).toEqual([
        { start: "2024-07-05T00:00:00Z", end: "2024-07-05T08:00:00Z" },
      ]);
    });

    it("accepts a BusinessCalendar as holidays, reading its holidays and not its weekend", () => {
      const calendar = {
        weekend: [6, 7],
        holidays: ["2024-07-04"],
        timeZone: "America/New_York",
      };
      expect(
        operatingIntervals(
          {
            timeZone: "America/New_York",
            weekly: { 4: nineToFive, 6: nineToFive },
            holidays: calendar,
          },
          julyWeek,
        ),
      ).toEqual([
        { start: "2024-07-06T13:00:00Z", end: "2024-07-06T21:00:00Z" },
      ]);
    });

    it.each`
      holidays                        | reads
      ${["2024-07-04[u-ca=iso8601]"]} | ${"an iso8601 annotation"}
      ${["2024-07-04", "2024-07-04"]} | ${"a duplicate"}
      ${["2024-07-04[foo=bar]"]}      | ${"an elective annotation"}
    `("normalises a holiday with $reads", ({ holidays }) => {
      expect(
        operatingIntervals(
          { timeZone: "America/New_York", weekly: { 4: nineToFive }, holidays },
          julyWeek,
        ),
      ).toEqual([]);
    });

    it("matches an override written with an annotation to its date", () => {
      expect(
        operatingIntervals(
          {
            timeZone: "America/New_York",
            weekly: { 4: nineToFive },
            overrides: [{ date: "2024-07-04[u-ca=iso8601]", windows: [] }],
          },
          julyWeek,
        ),
      ).toEqual([]);
    });
  });

  it("passes disambiguation through to the override windows", () => {
    const schedule = {
      timeZone: "America/New_York",
      weekly: {},
      overrides: [
        { date: "2024-03-10", windows: [{ from: "02:30", to: "04:00" }] },
      ],
    };
    const day = { start: "2024-03-10T00:00:00Z", end: "2024-03-11T00:00:00Z" };
    expect(operatingIntervals(schedule, day)).toEqual([
      { start: "2024-03-10T07:30:00Z", end: "2024-03-10T08:00:00Z" },
    ]);
    expect(
      operatingIntervals(schedule, day, { disambiguation: "earlier" }),
    ).toEqual([{ start: "2024-03-10T06:30:00Z", end: "2024-03-10T08:00:00Z" }]);
    expect(
      operatingIntervals(schedule, day, { disambiguation: "reject" }),
    ).toEqual([]);
  });

  it.each(battleTestTimeZones)(
    "closes a mid-week holiday in %s's local dates",
    (timeZone) => {
      const range = {
        start: local("2024-06-10T00:00", timeZone),
        end: local("2024-06-17T00:00", timeZone),
      };
      const expected = [10, 11, 13, 14].map((day) => ({
        start: local(`2024-06-${day}T09:00`, timeZone),
        end: local(`2024-06-${day}T17:00`, timeZone),
      }));
      expect(
        operatingIntervals(
          { timeZone, weekly: weekdays, holidays: ["2024-06-12"] },
          range,
        ),
      ).toEqual(expected);
    },
  );

  describe("invalid input", () => {
    const day = { start: "2024-06-10T00:00:00Z", end: "2024-06-11T00:00:00Z" };
    const valid = { timeZone: "UTC", weekly: { 1: nineToFive } };

    it("is not empty for the valid baseline", () => {
      expect(operatingIntervals(valid, day)).toHaveLength(1);
    });

    it.each`
      schedule                                                                                                             | reads
      ${null}                                                                                                              | ${"null"}
      ${[valid]}                                                                                                           | ${"an array"}
      ${"UTC"}                                                                                                             | ${"a string"}
      ${{ weekly: { 1: nineToFive } }}                                                                                     | ${"no timeZone"}
      ${{ ...valid, timeZone: "Invalid/Zone" }}                                                                            | ${"an invalid zone"}
      ${{ timeZone: "UTC" }}                                                                                               | ${"no weekly"}
      ${{ ...valid, weekly: { 8: nineToFive } }}                                                                           | ${"weekday 8"}
      ${{ ...valid, weekly: { 1: [{ from: "09:00", to: "25:00" }] } }}                                                     | ${"a malformed window"}
      ${{ ...valid, holidays: "2024-06-10" }}                                                                              | ${"holidays as a string"}
      ${{ ...valid, holidays: [20240610] }}                                                                                | ${"a numeric holiday"}
      ${{ ...valid, holidays: ["2024-02-30"] }}                                                                            | ${"an impossible holiday"}
      ${{ ...valid, holidays: ["2024-06-10T00:00"] }}                                                                      | ${"a date-time holiday"}
      ${{ ...valid, holidays: ["2024-06-10[u-ca=hebrew]"] }}                                                               | ${"a non-ISO holiday"}
      ${{ ...valid, holidays: { weekend: [1, 2, 3, 4, 5, 6, 7], holidays: [], timeZone: "UTC" } }}                         | ${"an invalid BusinessCalendar"}
      ${{ ...valid, holidays: { weekend: [6, 7], holidays: [] } }}                                                         | ${"a BusinessCalendar without a zone"}
      ${{ ...valid, overrides: { date: "2024-06-10", windows: [] } }}                                                      | ${"overrides not in an array"}
      ${{ ...valid, overrides: [{ windows: [] }] }}                                                                        | ${"an override without a date"}
      ${{ ...valid, overrides: [{ date: "2024-06-31", windows: [] }] }}                                                    | ${"an impossible override date"}
      ${{ ...valid, overrides: [{ date: "2024-06-10" }] }}                                                                 | ${"an override without windows"}
      ${{ ...valid, overrides: [{ date: "2024-06-10", windows: [{ from: "09:00" }] }] }}                                   | ${"an override with a malformed window"}
      ${{ ...valid, overrides: [null] }}                                                                                   | ${"a null override"}
      ${{ ...valid, overrides: [{ date: "2024-06-10", windows: [] }, { date: "2024-06-10", windows: nineToFive }] }}       | ${"two overrides for one date"}
      ${{ ...valid, overrides: [{ date: "2024-06-10", windows: [] }, { date: "2024-06-10[u-ca=iso8601]", windows: [] }] }} | ${"two spellings of one override date"}
    `("returns [] for a schedule with $reads", ({ schedule }) => {
      expect(operatingIntervals(schedule, day)).toEqual([]);
    });

    it.each`
      range                                                             | options                        | reads
      ${{ start: "2024-06-11T00:00:00Z", end: "2024-06-10T00:00:00Z" }} | ${undefined}                   | ${"an inverted range"}
      ${{ start: "2024-06-10", end: "2024-06-11" }}                     | ${undefined}                   | ${"a date range"}
      ${day}                                                            | ${{ disambiguation: "first" }} | ${"an unknown disambiguation"}
      ${day}                                                            | ${null}                        | ${"null options"}
      ${day}                                                            | ${42}                          | ${"numeric options"}
      ${{ start: "2000-01-01T00:00:00Z", end: "2030-01-01T00:00:00Z" }} | ${undefined}                   | ${"a range past 10,000 local days"}
    `("returns [] for $reads", ({ range, options }) => {
      expect(operatingIntervals(valid, range, options)).toEqual([]);
    });

    it("answers a range whose last instant is on the walk's last allowed date, and refuses one a nanosecond longer", () => {
      // A range may span 10,000 local dates from its start's: 2000-01-01 to 2027-05-18, never
      // 2027-05-19.
      const lateOpening = {
        timeZone: "UTC",
        weekly: {},
        overrides: [
          { date: "2027-05-18", windows: [{ from: "23:00", to: "00:00" }] },
        ],
      };
      expect(
        operatingIntervals(lateOpening, {
          start: "2000-01-01T00:00:00Z",
          end: "2027-05-19T00:00:00Z",
        }),
      ).toEqual([
        { start: "2027-05-18T23:00:00Z", end: "2027-05-19T00:00:00Z" },
      ]);
      expect(
        operatingIntervals(lateOpening, {
          start: "2000-01-01T00:00:00Z",
          end: "2027-05-19T00:00:00.000000001Z",
        }),
      ).toEqual([]);
    });

    it("returns [] rather than throwing for hostile arguments", () => {
      expect(operatingIntervals(hostileProxy() as never, day)).toEqual([]);
      expect(operatingIntervals(revokedProxy() as never, day)).toEqual([]);
      expect(
        operatingIntervals(
          { ...valid, holidays: hostileProxy() } as never,
          day,
        ),
      ).toEqual([]);
      expect(
        operatingIntervals(
          { ...valid, overrides: [hostileProxy()] } as never,
          day,
        ),
      ).toEqual([]);
      expect(operatingIntervals(valid, day, hostileProxy() as never)).toEqual(
        [],
      );
    });
  });
});

describe("operatingIntervals across a skipped local midnight", () => {
  const cairoDays = {
    start: "2024-04-25T00:00:00Z",
    end: "2024-04-27T00:00:00Z",
  };

  it.each`
    schedule                                                                                                                  | range                                                             | disambiguation  | expected
    ${cairo}                                                                                                                  | ${cairoDays}                                                      | ${"earlier"}    | ${[{ start: "2024-04-25T20:00:00Z", end: "2024-04-26T00:00:00Z" }]}
    ${cairo}                                                                                                                  | ${cairoDays}                                                      | ${"compatible"} | ${[{ start: "2024-04-25T20:00:00Z", end: "2024-04-25T21:45:00Z" }, { start: "2024-04-25T22:30:00Z", end: "2024-04-26T00:00:00Z" }]}
    ${cairo}                                                                                                                  | ${cairoDays}                                                      | ${"reject"}     | ${[]}
    ${{ timeZone: "America/Santiago", weekly: { 6: [{ from: "22:00", to: "23:45" }], 7: [{ from: "00:30", to: "03:00" }] } }} | ${{ start: "2024-09-07T00:00:00Z", end: "2024-09-09T00:00:00Z" }} | ${"earlier"}    | ${[{ start: "2024-09-08T02:00:00Z", end: "2024-09-08T06:00:00Z" }]}
  `(
    "merges a window moved onto the previous date under $disambiguation",
    ({ schedule, range, disambiguation, expected }) => {
      expect(operatingIntervals(schedule, range, { disambiguation })).toEqual(
        expected,
      );
    },
  );
});

describe("operatingIntervals at the limits of the instant range", () => {
  const allDay = [{ from: "00:00", to: "00:00" }];
  const always = {
    timeZone: "UTC",
    weekly: {
      1: allDay,
      2: allDay,
      3: allDay,
      4: allDay,
      5: allDay,
      6: allDay,
      7: allDay,
    },
  };

  it.each`
    range                                                                   | reads
    ${{ start: "+275760-09-12T00:00:00Z", end: "+275760-09-13T00:00:00Z" }} | ${"the last representable day"}
    ${{ start: "-271821-04-20T00:00:00Z", end: "-271821-04-21T00:00:00Z" }} | ${"the first representable day"}
    ${{ start: "+275734-01-01T00:00:00Z", end: "+275734-01-02T00:00:00Z" }} | ${"a day within 10,000 days of the end"}
  `(
    "returns the whole range for a schedule open around the clock on $reads",
    ({ range }) => {
      expect(operatingIntervals(always, range)).toEqual([range]);
    },
  );
});

describe("operatingIntervals when Temporal throws", () => {
  const schedule = {
    timeZone: "America/New_York",
    weekly: { 1: [{ from: "09:00", to: "17:00" }] },
  };

  it.each`
    mock                                            | reads
    ${mockTemporalPlainTimeFromThrow}               | ${"reading a window"}
    ${mockTemporalInstantFromEpochNanosecondsThrow} | ${"walking the local days"}
  `("returns the sentinel when $reads throws", ({ mock }) => {
    mock();
    expect(
      operatingIntervals(schedule, {
        start: "2024-06-10T00:00:00Z",
        end: "2024-06-11T00:00:00Z",
      }),
    ).toEqual([]);
  });
});
