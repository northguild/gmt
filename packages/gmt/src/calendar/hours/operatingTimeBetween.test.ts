import { Temporal } from "@js-temporal/polyfill";
import { intersectIntervals, sumIntervals } from "../../interval/calculate";
import { battleTestTimeZones } from "../../test";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import type { Interval, OperatingSchedule } from "../../types";
import { operatingIntervals } from "./operatingIntervals";
import { operatingTimeBetween } from "./operatingTimeBetween";

const nineToFive = [{ from: "09:00", to: "17:00" }];
const allDay = [{ from: "00:00", to: "00:00" }];
const office = {
  timeZone: "America/New_York",
  weekly: {
    1: nineToFive,
    2: nineToFive,
    3: nineToFive,
    4: nineToFive,
    5: nineToFive,
  },
};

function local(dateTime: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(dateTime)
    .toZonedDateTime(timeZone)
    .toInstant()
    .toString();
}

/** The same quantity built from the CORE-6 algebra: intersect each open interval with the range, sum. */
function viaAlgebra(schedule: OperatingSchedule, range: Interval): string {
  return sumIntervals(
    operatingIntervals(schedule, range)
      .map((open) => intersectIntervals(open, range))
      .filter((piece): piece is Interval => piece !== null),
  );
}

describe("operatingTimeBetween", () => {
  it("is PT40H over a Monday–Friday 09:00–17:00 week", () => {
    expect(
      operatingTimeBetween(
        "2024-06-10T04:00:00Z",
        "2024-06-17T04:00:00Z",
        office,
      ),
    ).toBe("PT40H");
  });

  it.each`
    start                          | end                                 | expected            | reads
    ${"2024-06-14T20:00:00Z"}      | ${"2024-06-17T14:00:00Z"}           | ${"PT2H"}           | ${"Friday 16:00 to Monday 10:00"}
    ${"2024-06-17T14:00:00Z"}      | ${"2024-06-17T14:30:00Z"}           | ${"PT30M"}          | ${"half an hour inside one window"}
    ${"2024-06-15T00:00:00Z"}      | ${"2024-06-17T04:00:00Z"}           | ${"PT0S"}           | ${"a closed weekend"}
    ${"2024-06-17T14:00:00Z"}      | ${"2024-06-17T14:00:00Z"}           | ${"PT0S"}           | ${"an empty range"}
    ${"2024-06-17T13:00:00Z"}      | ${"2024-06-17T13:00:00.000000001Z"} | ${"PT0.000000001S"} | ${"one nanosecond after opening"}
    ${"2024-06-17T10:00:00-04:00"} | ${"2024-06-17T17:00:00-04:00"}      | ${"PT7H"}           | ${"endpoints written with an offset"}
    ${"2024-06-03T04:00:00Z"}      | ${"2024-07-01T04:00:00Z"}           | ${"PT160H"}         | ${"four weeks: hours stay the largest unit"}
  `("is $expected for $reads", ({ start, end, expected }) => {
    expect(operatingTimeBetween(start, end, office)).toBe(expected);
  });

  it.each`
    start                     | end                       | expected    | reads
    ${"2024-11-03T04:00:00Z"} | ${"2024-11-04T05:00:00Z"} | ${"PT25H"}  | ${"the fall-back day"}
    ${"2024-03-10T05:00:00Z"} | ${"2024-03-11T04:00:00Z"} | ${"PT23H"}  | ${"the spring-forward day"}
    ${"2024-11-01T04:00:00Z"} | ${"2024-11-06T05:00:00Z"} | ${"PT121H"} | ${"five days across the fall-back"}
  `(
    "counts elapsed open time, not wall-clock hours: $expected for $reads",
    ({ start, end, expected }) => {
      const always = {
        timeZone: "America/New_York",
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
      expect(operatingTimeBetween(start, end, always)).toBe(expected);
    },
  );

  it("counts a holiday as closed and an override's windows only", () => {
    expect(
      operatingTimeBetween("2024-07-01T04:00:00Z", "2024-07-08T04:00:00Z", {
        ...office,
        holidays: ["2024-07-04"],
        overrides: [
          { date: "2024-07-05", windows: [{ from: "10:00", to: "12:00" }] },
        ],
      }),
    ).toBe("PT26H");
  });

  describe("equals the sum of the open intervals intersected with the range", () => {
    const schedules: [string, OperatingSchedule][] = [
      ["weekdays", office],
      [
        "nights with a holiday",
        {
          timeZone: "America/New_York",
          weekly: {
            5: [{ from: "23:00", to: "06:00" }],
            6: [{ from: "22:00", to: "02:00" }],
          },
          holidays: ["2024-11-08"],
        },
      ],
      [
        "split shifts",
        {
          timeZone: "America/New_York",
          weekly: {
            1: [
              { from: "06:00", to: "10:00" },
              { from: "15:00", to: "19:30" },
            ],
            3: allDay,
          },
        },
      ],
    ];
    const ranges: Interval[] = [
      { start: "2024-10-30T12:34:56Z", end: "2024-11-12T01:02:03.5Z" },
      { start: "2024-03-01T00:00:00Z", end: "2024-03-20T00:00:00Z" },
      { start: "2024-06-17T15:00:00Z", end: "2024-06-17T15:00:00Z" },
    ];

    it.each(schedules)("for %s", (_, schedule) => {
      for (const range of ranges) {
        expect(operatingTimeBetween(range.start, range.end, schedule)).toBe(
          viaAlgebra(schedule, range),
        );
      }
    });

    it.each(battleTestTimeZones)("for weekdays in %s", (timeZone) => {
      const schedule = { ...office, timeZone };
      const range = {
        start: local("2024-02-26T10:15", timeZone),
        end: local("2024-03-12T16:45", timeZone),
      };
      expect(operatingTimeBetween(range.start, range.end, schedule)).toBe(
        viaAlgebra(schedule, range),
      );
    });
  });

  it.each(battleTestTimeZones)(
    "is PT40H over a local June week in %s",
    (timeZone) => {
      expect(
        operatingTimeBetween(
          local("2024-06-10T00:00", timeZone),
          local("2024-06-17T00:00", timeZone),
          { ...office, timeZone },
        ),
      ).toBe("PT40H");
    },
  );

  // Sunday 10 March 2024 in New York: 02:30 does not exist; the rejected window could span
  // 06:30Z–08:00Z.
  describe("disambiguation", () => {
    const gap = {
      timeZone: "America/New_York",
      weekly: {
        7: [
          { from: "02:30", to: "04:00" },
          { from: "12:00", to: "13:00" },
        ],
      },
    };

    it.each`
      start                     | end                       | disambiguation | expected
      ${"2024-03-10T05:00:00Z"} | ${"2024-03-11T04:00:00Z"} | ${undefined}   | ${"PT1H30M"}
      ${"2024-03-10T05:00:00Z"} | ${"2024-03-11T04:00:00Z"} | ${"later"}     | ${"PT1H30M"}
      ${"2024-03-10T05:00:00Z"} | ${"2024-03-11T04:00:00Z"} | ${"earlier"}   | ${"PT2H30M"}
      ${"2024-03-10T05:00:00Z"} | ${"2024-03-11T04:00:00Z"} | ${"reject"}    | ${""}
      ${"2024-03-10T08:00:00Z"} | ${"2024-03-11T04:00:00Z"} | ${"reject"}    | ${"PT1H"}
    `(
      "is $expected from $start under $disambiguation",
      ({ start, end, disambiguation, expected }) => {
        expect(operatingTimeBetween(start, end, gap, { disambiguation })).toBe(
          expected,
        );
      },
    );
  });

  describe("invalid input", () => {
    it.each`
      start                     | end                       | schedule                                           | options                  | reads
      ${"2024-06-17T00:00:00Z"} | ${"2024-06-10T00:00:00Z"} | ${office}                                          | ${undefined}             | ${"start after end"}
      ${"2024-06-10T00:00:00"}  | ${"2024-06-17T00:00:00Z"} | ${office}                                          | ${undefined}             | ${"a start without an offset"}
      ${"2024-06-10T00:00:00Z"} | ${"2024-06-17"}           | ${office}                                          | ${undefined}             | ${"a date end"}
      ${"2024-06-10T00:00:00Z"} | ${"2024-06-17T00:00:00Z"} | ${{ ...office, weekly: { 1: [{ to: "17:00" }] } }} | ${undefined}             | ${"a malformed window"}
      ${"2024-06-10T00:00:00Z"} | ${"2024-06-17T00:00:00Z"} | ${{ ...office, timeZone: undefined }}              | ${undefined}             | ${"no zone"}
      ${"2024-06-10T00:00:00Z"} | ${"2024-06-17T00:00:00Z"} | ${office}                                          | ${{ disambiguation: 1 }} | ${"a numeric disambiguation"}
      ${"2024-06-10T00:00:00Z"} | ${"2024-06-17T00:00:00Z"} | ${office}                                          | ${null}                  | ${"null options"}
      ${"2000-01-01T00:00:00Z"} | ${"2030-01-01T00:00:00Z"} | ${office}                                          | ${undefined}             | ${"a range past 10,000 local days"}
    `(
      "returns the sentinel for $reads",
      ({ start, end, schedule, options }) => {
        expect(operatingTimeBetween(start, end, schedule, options)).toBe("");
      },
    );

    it("returns the sentinel rather than throwing for hostile arguments", () => {
      expect(
        operatingTimeBetween(
          hostileProxy() as never,
          "2024-06-17T00:00:00Z",
          office,
        ),
      ).toBe("");
      expect(
        operatingTimeBetween(
          "2024-06-10T00:00:00Z",
          "2024-06-17T00:00:00Z",
          revokedProxy() as never,
        ),
      ).toBe("");
    });
  });
});

describe("operatingTimeBetween when Temporal throws", () => {
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
      operatingTimeBetween(
        "2024-06-10T00:00:00Z",
        "2024-06-11T00:00:00Z",
        schedule,
      ),
    ).toBe("");
  });
});
