import { Temporal } from "../../internal/temporal";
import { intersectIntervals, sumIntervals } from "../../interval/calculate";
import { battleTestTimeZones } from "../../test";
import {
  mockTemporalZonedDateTimeOffsetThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/hostileValues";
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

/** The same quantity from the interval functions: intersect each open interval with the range, then sum. */
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
      "is '$expected' from $start under $disambiguation",
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

describe("operatingTimeBetween across a skipped local midnight", () => {
  // Africa/Cairo, 2024-04-26: see operatingIntervals.test.ts. Thursday 20:00Z–21:45Z, Friday
  // 00:30–03:00 read "earlier" as 21:30Z–00:00Z; merged, four hours.
  const cairo = {
    timeZone: "Africa/Cairo",
    weekly: {
      4: [{ from: "22:00", to: "23:45" }],
      5: [{ from: "00:30", to: "03:00" }],
    },
  };

  it.each`
    start                     | end                       | disambiguation | expected
    ${"2024-04-25T00:00:00Z"} | ${"2024-04-27T00:00:00Z"} | ${"earlier"}   | ${"PT4H"}
    ${"2024-04-25T20:00:00Z"} | ${"2024-04-25T21:45:00Z"} | ${"reject"}    | ${""}
    ${"2024-04-25T20:00:00Z"} | ${"2024-04-25T21:30:00Z"} | ${"reject"}    | ${"PT1H30M"}
  `(
    "is '$expected' from $start to $end under $disambiguation",
    ({ start, end, disambiguation, expected }) => {
      expect(operatingTimeBetween(start, end, cairo, { disambiguation })).toBe(
        expected,
      );
    },
  );
});

describe("operatingTimeBetween when Temporal throws", () => {
  const schedule = {
    timeZone: "America/New_York",
    weekly: { 1: [{ from: "09:00", to: "17:00" }] },
  };

  it.each`
    mock                                    | reads
    ${mockTemporalPlainTimeFromThrow}       | ${"reading a window"}
    ${mockTemporalZonedDateTimeOffsetThrow} | ${"walking the local days"}
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

describe("operatingTimeBetween over ten years", () => {
  // Monday to Thursday 09:00-17:00 (8 h) and Friday 09:00-16:00 (7 h) is 39 h a week.
  // 2020-01-06 to 2030-01-07 is 3654 days, exactly 522 weeks, so 522 x 39 = 20358 h before
  // holidays. 2021-12-24 is a Friday (7 h) and 2022-12-26 a Monday (8 h) and 2025-07-01 a Tuesday
  // whose override opens for 2 h, losing 6 h. 20358 - 7 - 8 - 6 = 20337 h.
  const weekly = {
    1: nineToFive,
    2: nineToFive,
    3: nineToFive,
    4: nineToFive,
    5: [{ from: "09:00", to: "16:00" }],
  };
  const extras = {
    holidays: ["2021-12-24", "2022-12-26"],
    overrides: [
      { date: "2025-07-01", windows: [{ from: "10:00", to: "12:00" }] },
    ],
  };

  it.each`
    timeZone           | start                     | end                       | expected
    ${"Europe/London"} | ${"2020-01-06T00:00:00Z"} | ${"2030-01-07T00:00:00Z"} | ${"PT20337H"}
    ${"UTC"}           | ${"2020-01-06T00:00:00Z"} | ${"2030-01-07T00:00:00Z"} | ${"PT20337H"}
    ${"+05:45"}        | ${"2020-01-05T18:15:00Z"} | ${"2030-01-06T18:15:00Z"} | ${"PT20337H"}
  `(
    "$timeZone from $start to $end is $expected",
    ({ timeZone, start, end, expected }) => {
      expect(
        operatingTimeBetween(start, end, { timeZone, weekly, ...extras }),
      ).toBe(expected);
    },
  );

  it("counts a skipped local date once in Pacific/Apia", () => {
    // 2011-12-30 did not exist; 29 December (-10:00) and 31 December (+14:00) give 8 h each.
    expect(
      operatingTimeBetween(
        "2011-12-29T00:00:00-10:00",
        "2012-01-01T00:00:00+14:00",
        {
          timeZone: "Pacific/Apia",
          weekly: {
            1: nineToFive,
            2: nineToFive,
            3: nineToFive,
            4: nineToFive,
            5: nineToFive,
            6: nineToFive,
            7: nineToFive,
          },
        },
      ),
    ).toBe("PT16H");
  });

  it("returns the sentinel under reject when a range edge sits in the skipped hour", () => {
    expect(
      operatingTimeBetween(
        "2024-03-30T00:00:00Z",
        "2024-04-02T00:00:00Z",
        {
          timeZone: "Europe/London",
          weekly: { 7: [{ from: "01:30", to: "05:00" }] },
        },
        { disambiguation: "reject" },
      ),
    ).toBe("");
  });
});

describe("operatingTimeBetween across a year of clock changes", () => {
  const plusDays = (date: string, days: number): string =>
    Temporal.PlainDate.from(date).add({ days }).toString();

  // A daily window, a holiday on the change date and three days later, and three
  // overrides around it (evening-into-night, the same window, closed).
  it.each`
    timeZone                 | from       | to         | change          | start                     | end                       | disambiguation  | expected
    ${"Europe/London"}       | ${"01:30"} | ${"02:30"} | ${"2024-10-27"} | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"compatible"} | ${"PT367H"}
    ${"Europe/London"}       | ${"01:30"} | ${"02:30"} | ${"2024-10-27"} | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"earlier"}    | ${"PT368H"}
    ${"Europe/London"}       | ${"01:30"} | ${"02:30"} | ${"2024-10-27"} | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"later"}      | ${"PT367H"}
    ${"Europe/London"}       | ${"01:30"} | ${"02:30"} | ${"2024-10-27"} | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"reject"}     | ${""}
    ${"Australia/Lord_Howe"} | ${"01:45"} | ${"02:15"} | ${"2024-04-07"} | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"compatible"} | ${"PT186H30M"}
    ${"Australia/Lord_Howe"} | ${"01:45"} | ${"02:15"} | ${"2024-04-07"} | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"earlier"}    | ${"PT186H"}
    ${"Australia/Lord_Howe"} | ${"01:45"} | ${"02:15"} | ${"2024-04-07"} | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"later"}      | ${"PT186H30M"}
    ${"Australia/Lord_Howe"} | ${"01:45"} | ${"02:15"} | ${"2024-04-07"} | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"reject"}     | ${""}
    ${"Pacific/Apia"}        | ${"23:30"} | ${"00:30"} | ${"2011-12-29"} | ${"2011-06-01T00:00:00Z"} | ${"2012-06-01T00:00:00Z"} | ${"compatible"} | ${"PT367H"}
    ${"Pacific/Apia"}        | ${"23:30"} | ${"00:30"} | ${"2011-12-29"} | ${"2011-06-01T00:00:00Z"} | ${"2012-06-01T00:00:00Z"} | ${"earlier"}    | ${"PT367H"}
    ${"Pacific/Apia"}        | ${"23:30"} | ${"00:30"} | ${"2011-12-29"} | ${"2011-06-01T00:00:00Z"} | ${"2012-06-01T00:00:00Z"} | ${"later"}      | ${"PT367H"}
    ${"Pacific/Apia"}        | ${"23:30"} | ${"00:30"} | ${"2011-12-29"} | ${"2011-06-01T00:00:00Z"} | ${"2012-06-01T00:00:00Z"} | ${"reject"}     | ${"PT367H"}
    ${"America/Goose_Bay"}   | ${"23:30"} | ${"00:30"} | ${"2010-11-06"} | ${"2010-06-01T00:00:00Z"} | ${"2011-06-01T00:00:00Z"} | ${"compatible"} | ${"PT366H"}
    ${"America/Goose_Bay"}   | ${"23:30"} | ${"00:30"} | ${"2010-11-06"} | ${"2010-06-01T00:00:00Z"} | ${"2011-06-01T00:00:00Z"} | ${"earlier"}    | ${"PT365H"}
    ${"America/Goose_Bay"}   | ${"23:30"} | ${"00:30"} | ${"2010-11-06"} | ${"2010-06-01T00:00:00Z"} | ${"2011-06-01T00:00:00Z"} | ${"later"}      | ${"PT366H"}
    ${"America/Goose_Bay"}   | ${"23:30"} | ${"00:30"} | ${"2010-11-06"} | ${"2010-06-01T00:00:00Z"} | ${"2011-06-01T00:00:00Z"} | ${"reject"}     | ${""}
    ${"America/Sao_Paulo"}   | ${"23:30"} | ${"00:30"} | ${"2018-11-03"} | ${"2018-06-01T00:00:00Z"} | ${"2019-06-01T00:00:00Z"} | ${"compatible"} | ${"PT367H"}
    ${"America/Sao_Paulo"}   | ${"23:30"} | ${"00:30"} | ${"2018-11-03"} | ${"2018-06-01T00:00:00Z"} | ${"2019-06-01T00:00:00Z"} | ${"earlier"}    | ${"PT367H"}
    ${"America/Sao_Paulo"}   | ${"23:30"} | ${"00:30"} | ${"2018-11-03"} | ${"2018-06-01T00:00:00Z"} | ${"2019-06-01T00:00:00Z"} | ${"later"}      | ${"PT366H"}
    ${"America/Sao_Paulo"}   | ${"23:30"} | ${"00:30"} | ${"2018-11-03"} | ${"2018-06-01T00:00:00Z"} | ${"2019-06-01T00:00:00Z"} | ${"reject"}     | ${""}
    ${"Pacific/Chatham"}     | ${"03:00"} | ${"04:00"} | ${"2024-04-07"} | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"compatible"} | ${"PT366H"}
    ${"Pacific/Chatham"}     | ${"03:00"} | ${"04:00"} | ${"2024-04-07"} | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"earlier"}    | ${"PT367H"}
    ${"Pacific/Chatham"}     | ${"03:00"} | ${"04:00"} | ${"2024-04-07"} | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"later"}      | ${"PT367H"}
    ${"Pacific/Chatham"}     | ${"03:00"} | ${"04:00"} | ${"2024-04-07"} | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"reject"}     | ${""}
    ${"Europe/Dublin"}       | ${"01:30"} | ${"02:30"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"compatible"} | ${"PT366H"}
    ${"Europe/Dublin"}       | ${"01:30"} | ${"02:30"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"earlier"}    | ${"PT367H"}
    ${"Europe/Dublin"}       | ${"01:30"} | ${"02:30"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"later"}      | ${"PT365H"}
    ${"Europe/Dublin"}       | ${"01:30"} | ${"02:30"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"reject"}     | ${""}
    ${"Antarctica/Troll"}    | ${"02:00"} | ${"04:00"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"compatible"} | ${"PT732H"}
    ${"Antarctica/Troll"}    | ${"02:00"} | ${"04:00"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"earlier"}    | ${"PT734H"}
    ${"Antarctica/Troll"}    | ${"02:00"} | ${"04:00"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"later"}      | ${"PT730H"}
    ${"Antarctica/Troll"}    | ${"02:00"} | ${"04:00"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"reject"}     | ${""}
    ${"Asia/Kolkata"}        | ${"01:30"} | ${"02:30"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"compatible"} | ${"PT366H"}
    ${"Asia/Kolkata"}        | ${"01:30"} | ${"02:30"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"earlier"}    | ${"PT366H"}
    ${"Asia/Kolkata"}        | ${"01:30"} | ${"02:30"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"later"}      | ${"PT366H"}
    ${"Asia/Kolkata"}        | ${"01:30"} | ${"02:30"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"reject"}     | ${"PT366H"}
    ${"+05:45:30"}           | ${"01:30"} | ${"02:30"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"compatible"} | ${"PT366H"}
    ${"+05:45:30"}           | ${"01:30"} | ${"02:30"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"earlier"}    | ${"PT366H"}
    ${"+05:45:30"}           | ${"01:30"} | ${"02:30"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"later"}      | ${"PT366H"}
    ${"+05:45:30"}           | ${"01:30"} | ${"02:30"} | ${""}           | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"reject"}     | ${"PT366H"}
  `(
    "$timeZone $from–$to around '$change' from $start to $end, $disambiguation, is '$expected'",
    ({ timeZone, from, to, change, start, end, disambiguation, expected }) => {
      const window = [{ from, to }];
      const schedule: OperatingSchedule = {
        timeZone,
        weekly: {
          1: window,
          2: window,
          3: window,
          4: window,
          5: window,
          6: window,
          7: window,
        },
        ...(change === ""
          ? {}
          : {
              holidays: [change, plusDays(change, 3)],
              overrides: [
                {
                  date: plusDays(change, -1),
                  windows: [{ from: "22:00", to: "03:00" }],
                },
                { date: plusDays(change, 1), windows: window },
                { date: plusDays(change, 2), windows: [] },
              ],
            }),
      };
      expect(
        operatingTimeBetween(start, end, schedule, { disambiguation }),
      ).toBe(expected);
    },
  );
});

describe("operatingTimeBetween next to Temporal's first and last instant", () => {
  it.each`
    timeZone           | start                        | end                          | expected
    ${"UTC"}           | ${"-271821-04-20T00:00:00Z"} | ${"-271820-05-24T00:00:00Z"} | ${"PT3200H"}
    ${"UTC"}           | ${"+275759-08-10T00:00:00Z"} | ${"+275760-09-13T00:00:00Z"} | ${"PT3200H"}
    ${"UTC"}           | ${"-271821-05-19T00:00:00Z"} | ${"-271820-06-22T00:00:00Z"} | ${"PT3200H"}
    ${"UTC"}           | ${"+275759-07-12T00:00:00Z"} | ${"+275760-08-15T00:00:00Z"} | ${"PT3200H"}
    ${"UTC"}           | ${"-271821-05-20T00:00:00Z"} | ${"-271820-06-23T00:00:00Z"} | ${"PT3200H"}
    ${"UTC"}           | ${"+275759-07-11T00:00:00Z"} | ${"+275760-08-14T00:00:00Z"} | ${"PT3200H"}
    ${"UTC"}           | ${"-271821-05-21T00:00:00Z"} | ${"-271820-06-24T00:00:00Z"} | ${"PT3200H"}
    ${"UTC"}           | ${"+275759-07-10T00:00:00Z"} | ${"+275760-08-13T00:00:00Z"} | ${"PT3200H"}
    ${"Europe/London"} | ${"-271821-04-20T00:00:00Z"} | ${"-271820-05-24T00:00:00Z"} | ${"PT3200H"}
    ${"Europe/London"} | ${"+275759-08-10T00:00:00Z"} | ${"+275760-09-13T00:00:00Z"} | ${"PT3200H"}
    ${"Europe/London"} | ${"-271821-05-19T00:00:00Z"} | ${"-271820-06-22T00:00:00Z"} | ${"PT3200H"}
    ${"Europe/London"} | ${"+275759-07-12T00:00:00Z"} | ${"+275760-08-15T00:00:00Z"} | ${"PT3200H"}
    ${"Europe/London"} | ${"-271821-05-20T00:00:00Z"} | ${"-271820-06-23T00:00:00Z"} | ${"PT3200H"}
    ${"Europe/London"} | ${"+275759-07-11T00:00:00Z"} | ${"+275760-08-14T00:00:00Z"} | ${"PT3200H"}
    ${"Europe/London"} | ${"-271821-05-21T00:00:00Z"} | ${"-271820-06-24T00:00:00Z"} | ${"PT3200H"}
    ${"Europe/London"} | ${"+275759-07-10T00:00:00Z"} | ${"+275760-08-13T00:00:00Z"} | ${"PT3200H"}
  `(
    "$timeZone from $start to $end is $expected",
    ({ timeZone, start, end, expected }) => {
      const window = [{ from: "09:00", to: "17:00" }];
      const schedule: OperatingSchedule = {
        timeZone,
        weekly: {
          1: window,
          2: window,
          3: window,
          4: window,
          5: window,
          6: window,
          7: window,
        },
      };
      expect(operatingTimeBetween(start, end, schedule)).toBe(expected);
    },
  );
});

describe("operatingTimeBetween with overlapping and unsorted windows", () => {
  const schedule: OperatingSchedule = {
    timeZone: "UTC",
    weekly: {
      1: [
        { from: "10:00", to: "12:00" },
        { from: "09:00", to: "11:00" },
        { from: "09:30", to: "10:00" },
      ],
      2: [
        { from: "22:00", to: "03:00" },
        { from: "01:00", to: "02:00" },
      ],
    },
    holidays: ["2024-03-12"],
    overrides: [
      {
        date: "2024-03-05",
        windows: [
          { from: "12:00", to: "14:00" },
          { from: "08:00", to: "13:00" },
        ],
      },
      {
        date: "2024-03-06",
        windows: [
          { from: "12:00", to: "14:00" },
          { from: "08:00", to: "13:00" },
          { from: "20:00", to: "23:00" },
        ],
      },
    ],
  };

  it.each`
    start                     | end                       | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T00:00:00Z"} | ${"PT474H"}
    ${"2024-01-01T05:00:00Z"} | ${"2024-12-31T07:00:00Z"} | ${"PT475H"}
  `(
    "counts each moment once from $start to $end: $expected",
    ({ start, end, expected }) => {
      expect(operatingTimeBetween(start, end, schedule)).toBe(expected);
    },
  );
});

describe("operatingTimeBetween with windows that start together", () => {
  const schedule: OperatingSchedule = {
    timeZone: "UTC",
    weekly: {
      1: [
        { from: "09:00", to: "11:00" },
        { from: "09:00", to: "10:00" },
        { from: "09:00", to: "12:00" },
      ],
      3: [
        { from: "08:00", to: "09:00" },
        { from: "08:00", to: "09:00" },
      ],
    },
    overrides: [
      {
        date: "2024-03-05",
        windows: [
          { from: "08:00", to: "10:00" },
          { from: "08:00", to: "09:00" },
        ],
      },
    ],
  };

  it.each`
    start                     | end                       | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-12-31T00:00:00Z"} | ${"PT213H"}
    ${"2024-01-01T09:30:00Z"} | ${"2024-12-31T08:30:00Z"} | ${"PT212H30M"}
  `(
    "counts each moment once from $start to $end: $expected",
    ({ start, end, expected }) => {
      expect(operatingTimeBetween(start, end, schedule)).toBe(expected);
    },
  );
});
