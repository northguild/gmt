import { Temporal } from "../../internal/temporal";
import { battleTestTimeZones } from "../../test";
import {
  mockTemporalZonedDateTimeOffsetThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { addOperatingTime } from "./addOperatingTime";
import { operatingTimeBetween } from "./operatingTimeBetween";

const nineToFive = [{ from: "09:00", to: "17:00" }];
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
/** Friday 14 June 2024, 16:00 EDT. */
const fridayFour = "2024-06-14T20:00:00Z";

function local(dateTime: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(dateTime)
    .toZonedDateTime(timeZone)
    .toInstant()
    .toString();
}

describe("addOperatingTime", () => {
  it("carries two open hours from Friday 16:00 to Monday 10:00", () => {
    // One hour on Friday, one on Monday from 09:00 EDT: Monday 10:00 EDT is 14:00 UTC.
    expect(addOperatingTime(fridayFour, "PT2H", office)).toBe(
      "2024-06-17T14:00:00Z",
    );
  });

  it("returns the sentinel when the deadline falls past within", () => {
    expect(
      addOperatingTime(fridayFour, "PT2H", office, { within: "P1D" }),
    ).toBe("");
  });

  // From Friday 16:00 EDT: one hour Friday, then 09:00–17:00 EDT (13:00Z–21:00Z) each weekday.
  it.each`
    duration            | expected                            | reads
    ${"PT1H"}           | ${"2024-06-14T21:00:00Z"}           | ${"due at Friday's close, not Monday's opening"}
    ${"PT59M"}          | ${"2024-06-14T20:59:00Z"}           | ${"inside Friday's window"}
    ${"PT8H"}           | ${"2024-06-17T20:00:00Z"}           | ${"an eight-hour SLA: Monday 16:00"}
    ${"PT9H"}           | ${"2024-06-17T21:00:00Z"}           | ${"due exactly at Monday's close"}
    ${"PT1.5H"}         | ${"2024-06-17T13:30:00Z"}           | ${"a fractional hour"}
    ${"PT90M"}          | ${"2024-06-17T13:30:00Z"}           | ${"the same, in minutes"}
    ${"PT0.000000001S"} | ${"2024-06-14T20:00:00.000000001Z"} | ${"one nanosecond"}
    ${"PT41H"}          | ${"2024-06-21T21:00:00Z"}           | ${"a working week and an hour: the next Friday's close"}
    ${"PT0S"}           | ${"2024-06-14T20:00:00Z"}           | ${"no time: the start itself"}
  `("returns $expected for $duration: $reads", ({ duration, expected }) => {
    expect(addOperatingTime(fridayFour, duration, office)).toBe(expected);
  });

  it.each`
    start                          | duration  | expected                  | reads
    ${"2024-06-15T16:00:00Z"}      | ${"PT1H"} | ${"2024-06-17T14:00:00Z"} | ${"a start in closed time waits for the opening"}
    ${"2024-06-15T12:00:00-04:00"} | ${"PT0S"} | ${"2024-06-15T16:00:00Z"} | ${"a closed start with no time: the start in UTC"}
    ${"2024-06-17T13:00:00Z"}      | ${"PT8H"} | ${"2024-06-17T21:00:00Z"} | ${"a full day from the opening"}
  `("returns $expected: $reads", ({ start, duration, expected }) => {
    expect(addOperatingTime(start, duration, office)).toBe(expected);
  });

  it("skips a Monday holiday", () => {
    expect(
      addOperatingTime(fridayFour, "PT2H", {
        ...office,
        holidays: ["2024-06-17"],
      }),
    ).toBe("2024-06-18T14:00:00Z");
  });

  it("follows a night window across midnight", () => {
    expect(
      addOperatingTime("2024-06-14T22:00:00Z", "PT7H", {
        timeZone: "UTC",
        weekly: { 5: [{ from: "23:00", to: "06:00" }] },
      }),
    ).toBe("2024-06-15T06:00:00Z");
  });

  describe("the within horizon", () => {
    // Friday 16:00 EDT to the Monday 10:00 EDT deadline is two local days and 18 hours.
    it.each`
      within          | expected                  | reads
      ${"P2DT18H"}    | ${"2024-06-17T14:00:00Z"} | ${"a deadline exactly at the horizon counts"}
      ${"P2DT17H59M"} | ${""}                     | ${"one minute short"}
      ${undefined}    | ${"2024-06-17T14:00:00Z"} | ${"the default"}
    `("$reads (within $within)", ({ within, expected }) => {
      expect(addOperatingTime(fridayFour, "PT2H", office, { within })).toBe(
        expected,
      );
    });

    it("defaults to one year: 2,100 open hours is past it, and within P2Y finds it", () => {
      // 2,100 hours at 40 a week is 52.5 weeks.
      expect(addOperatingTime(fridayFour, "PT2100H", office)).toBe("");
      const due = addOperatingTime(fridayFour, "PT2100H", office, {
        within: "P2Y",
      });
      expect(due).not.toBe("");
      expect(operatingTimeBetween(fridayFour, due, office)).toBe("PT2100H");
    });
  });

  it.each(battleTestTimeZones)(
    "carries ten open hours from Friday 16:00 to Tuesday 10:00 local in %s",
    (timeZone) => {
      const schedule = { ...office, timeZone };
      const start = local("2024-06-14T16:00", timeZone);
      const due = addOperatingTime(start, "PT10H", schedule);
      expect(due).toBe(local("2024-06-18T10:00", timeZone));
      expect(operatingTimeBetween(start, due, schedule)).toBe("PT10H");
    },
  );

  // Sunday 10 March 2024 in New York: 02:30 does not exist. The window is 07:30Z–08:00Z under
  // "compatible", 06:30Z–08:00Z under "earlier"; Monday opens at 13:00Z.
  describe("disambiguation", () => {
    const gap = {
      timeZone: "America/New_York",
      weekly: { 7: [{ from: "02:30", to: "04:00" }], 1: nineToFive },
    };

    it.each`
      start                     | disambiguation | expected
      ${"2024-03-09T16:00:00Z"} | ${undefined}   | ${"2024-03-11T13:30:00Z"}
      ${"2024-03-09T16:00:00Z"} | ${"later"}     | ${"2024-03-11T13:30:00Z"}
      ${"2024-03-09T16:00:00Z"} | ${"earlier"}   | ${"2024-03-10T07:30:00Z"}
      ${"2024-03-09T16:00:00Z"} | ${"reject"}    | ${""}
      ${"2024-03-10T08:00:00Z"} | ${"reject"}    | ${"2024-03-11T14:00:00Z"}
    `(
      "returns $expected from $start under $disambiguation",
      ({ start, disambiguation, expected }) => {
        expect(addOperatingTime(start, "PT1H", gap, { disambiguation })).toBe(
          expected,
        );
      },
    );
  });

  describe("invalid input", () => {
    it.each`
      start                    | duration     | options                        | reads
      ${fridayFour}            | ${"P1D"}     | ${undefined}                   | ${"days, which could mean 24 open hours or a working day"}
      ${fridayFour}            | ${"PT0H"}    | ${{ within: "-P1D" }}          | ${"a negative horizon"}
      ${fridayFour}            | ${"P1W"}     | ${undefined}                   | ${"weeks"}
      ${fridayFour}            | ${"P1M"}     | ${undefined}                   | ${"months"}
      ${fridayFour}            | ${"P1Y"}     | ${undefined}                   | ${"years"}
      ${fridayFour}            | ${"P1DT2H"}  | ${undefined}                   | ${"days with hours"}
      ${fridayFour}            | ${"-PT1H"}   | ${undefined}                   | ${"a negative duration"}
      ${fridayFour}            | ${"PT"}      | ${undefined}                   | ${"an empty time part"}
      ${fridayFour}            | ${""}        | ${undefined}                   | ${"an empty string"}
      ${fridayFour}            | ${"2 hours"} | ${undefined}                   | ${"prose"}
      ${"2024-06-14T16:00:00"} | ${"PT2H"}    | ${undefined}                   | ${"a start without an offset"}
      ${fridayFour}            | ${"PT2H"}    | ${{ within: "P1" }}            | ${"a malformed horizon"}
      ${fridayFour}            | ${"PT2H"}    | ${{ disambiguation: "Later" }} | ${"a mis-cased disambiguation"}
      ${fridayFour}            | ${"PT2H"}    | ${null}                        | ${"null options"}
    `("returns the sentinel for $reads", ({ start, duration, options }) => {
      expect(addOperatingTime(start, duration, office, options)).toBe("");
    });

    it("returns the sentinel for an invalid schedule", () => {
      expect(
        addOperatingTime(fridayFour, "PT2H", {
          ...office,
          weekly: { 7.5: nineToFive },
        } as never),
      ).toBe("");
      expect(addOperatingTime(fridayFour, "PT2H", null as never)).toBe("");
    });

    it("returns the sentinel rather than throwing for hostile arguments", () => {
      expect(addOperatingTime(hostileProxy() as never, "PT2H", office)).toBe(
        "",
      );
      expect(
        addOperatingTime(fridayFour, hostileProxy() as never, office),
      ).toBe("");
      expect(
        addOperatingTime(fridayFour, "PT2H", revokedProxy() as never),
      ).toBe("");
      expect(
        addOperatingTime(fridayFour, "PT2H", office, hostileProxy() as never),
      ).toBe("");
    });
  });
});

describe("addOperatingTime across a skipped local midnight", () => {
  // Africa/Cairo, 2024-04-26: Thursday 20:00Z–21:45Z, Friday 00:30–03:00 read "earlier" as
  // 21:30Z–00:00Z. Under "reject" Friday's widest span starts at 21:30Z.
  const cairo = {
    timeZone: "Africa/Cairo",
    weekly: {
      4: [{ from: "22:00", to: "23:45" }],
      5: [{ from: "00:30", to: "03:00" }],
    },
  };

  it.each`
    duration     | disambiguation | expected
    ${"PT2H"}    | ${"earlier"}   | ${"2024-04-25T22:00:00Z"}
    ${"PT1H45M"} | ${"reject"}    | ${""}
    ${"PT1H30M"} | ${"reject"}    | ${"2024-04-25T21:30:00Z"}
  `(
    "returns $expected for $duration under $disambiguation",
    ({ duration, disambiguation, expected }) => {
      expect(
        addOperatingTime("2024-04-25T20:00:00Z", duration, cairo, {
          disambiguation,
        }),
      ).toBe(expected);
    },
  );
});

describe("addOperatingTime at the search cap", () => {
  // From Saturday 2024-06-15, the 10,000th local date is 2051-11-01: a deadline anywhere on it is
  // answered, and one on the date after is not, even at its first instant. So an hour ending at
  // that midnight is past the cap.
  // Worst CI run 3 s for a 30-year horizon; the timeout is three times that and more.
  it.each`
    date            | windows                             | expected
    ${"2051-11-01"} | ${[{ from: "09:00", to: "17:00" }]} | ${"2051-11-01T10:00:00Z"}
    ${"2051-11-01"} | ${[{ from: "22:00", to: "23:00" }]} | ${"2051-11-01T23:00:00Z"}
    ${"2051-11-01"} | ${[{ from: "23:00", to: "00:00" }]} | ${""}
    ${"2051-11-02"} | ${[{ from: "00:00", to: "01:00" }]} | ${""}
  `(
    "returns $expected for one open hour on $date under a 30-year horizon",
    ({ date, windows, expected }) => {
      expect(
        addOperatingTime(
          "2024-06-15T12:00:00Z",
          "PT1H",
          { timeZone: "UTC", weekly: {}, overrides: [{ date, windows }] },
          { within: "P30Y" },
        ),
      ).toBe(expected);
    },
    30_000,
  );
});

describe("addOperatingTime with a long horizon", () => {
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

  it("answers as soon as the deadline is known, inside a run that never ends", () => {
    expect(
      addOperatingTime("2024-06-15T12:00:00Z", "PT1H", always, {
        within: "P30Y",
      }),
    ).toBe("2024-06-15T13:00:00Z");
  });
});

describe("addOperatingTime when Temporal throws", () => {
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
    expect(addOperatingTime("2024-06-10T14:00:00Z", "PT1H", schedule)).toBe("");
  });
});

describe("addOperatingTime over many weeks", () => {
  // 39 h weeks (Monday to Thursday 8 h, Friday 09:00-16:00 7 h). Starting Monday 2024-01-08
  // 09:00, ten weeks use 390 h and end Friday 2024-03-15 16:00. The last 10 h are 8 h on Monday
  // 03-18 and 2 h on Tuesday 03-19, ending 11:00 GMT (summer time starts on 03-31).
  const weekly = {
    1: nineToFive,
    2: nineToFive,
    3: nineToFive,
    4: nineToFive,
    5: [{ from: "09:00", to: "16:00" }],
  };

  it.each`
    start                     | duration    | expected
    ${"2024-01-08T09:00:00Z"} | ${"PT400H"} | ${"2024-03-19T11:00:00Z"}
    ${"2024-01-08T09:00:00Z"} | ${"PT390H"} | ${"2024-03-15T16:00:00Z"}
  `(
    "$duration from $start ends at $expected",
    ({ start, duration, expected }) => {
      expect(
        addOperatingTime(start, duration, {
          timeZone: "Europe/London",
          weekly,
        }),
      ).toBe(expected);
    },
  );
});

describe("addOperatingTime next to Temporal's first and last instant", () => {
  it.each`
    timeZone           | start                        | amount      | within    | expected
    ${"UTC"}           | ${"-271821-04-20T00:00:00Z"} | ${"PT900H"} | ${"P1Y"}  | ${"-271821-08-10T13:00:00Z"}
    ${"UTC"}           | ${"+275760-08-04T00:00:00Z"} | ${"PT90H"}  | ${"P40D"} | ${"+275760-08-15T11:00:00Z"}
    ${"UTC"}           | ${"-271821-05-19T00:00:00Z"} | ${"PT900H"} | ${"P1Y"}  | ${"-271821-09-08T13:00:00Z"}
    ${"UTC"}           | ${"+275760-07-06T00:00:00Z"} | ${"PT90H"}  | ${"P40D"} | ${"+275760-07-17T11:00:00Z"}
    ${"UTC"}           | ${"-271821-05-20T00:00:00Z"} | ${"PT900H"} | ${"P1Y"}  | ${"-271821-09-09T13:00:00Z"}
    ${"UTC"}           | ${"+275760-07-05T00:00:00Z"} | ${"PT90H"}  | ${"P40D"} | ${"+275760-07-16T11:00:00Z"}
    ${"UTC"}           | ${"-271821-05-21T00:00:00Z"} | ${"PT900H"} | ${"P1Y"}  | ${"-271821-09-10T13:00:00Z"}
    ${"UTC"}           | ${"+275760-07-04T00:00:00Z"} | ${"PT90H"}  | ${"P40D"} | ${"+275760-07-15T11:00:00Z"}
    ${"Europe/London"} | ${"-271821-04-20T00:00:00Z"} | ${"PT900H"} | ${"P1Y"}  | ${"-271821-08-10T13:01:15Z"}
    ${"Europe/London"} | ${"+275760-08-04T00:00:00Z"} | ${"PT90H"}  | ${"P40D"} | ${"+275760-08-15T10:00:00Z"}
    ${"Europe/London"} | ${"-271821-05-19T00:00:00Z"} | ${"PT900H"} | ${"P1Y"}  | ${"-271821-09-08T13:01:15Z"}
    ${"Europe/London"} | ${"+275760-07-06T00:00:00Z"} | ${"PT90H"}  | ${"P40D"} | ${"+275760-07-17T10:00:00Z"}
    ${"Europe/London"} | ${"-271821-05-20T00:00:00Z"} | ${"PT900H"} | ${"P1Y"}  | ${"-271821-09-09T13:01:15Z"}
    ${"Europe/London"} | ${"+275760-07-05T00:00:00Z"} | ${"PT90H"}  | ${"P40D"} | ${"+275760-07-16T10:00:00Z"}
    ${"Europe/London"} | ${"-271821-05-21T00:00:00Z"} | ${"PT900H"} | ${"P1Y"}  | ${"-271821-09-10T13:01:15Z"}
    ${"Europe/London"} | ${"+275760-07-04T00:00:00Z"} | ${"PT90H"}  | ${"P40D"} | ${"+275760-07-15T10:00:00Z"}
  `(
    "$amount from $start in $timeZone within $within ends at $expected",
    ({ timeZone, start, amount, within, expected }) => {
      const window = [{ from: "09:00", to: "17:00" }];
      const schedule = {
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
      expect(addOperatingTime(start, amount, schedule, { within })).toBe(
        expected,
      );
    },
  );

  it("counts overlapping and unsorted windows once", () => {
    const schedule = {
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
    expect(addOperatingTime("2024-01-01T00:00:00Z", "PT400H", schedule)).toBe(
      "2024-11-04T10:00:00Z",
    );
  });
});

describe("addOperatingTime from the instant a clock change repeats the start of an all-day window", () => {
  // Goose_Bay fell back at 2010-11-07T03:01:00Z, repeating 23:01-00:01. Sunday's window is
  // 00:00 to 00:00; "compatible" and "earlier" open it at its first 00:00, 03:00Z, so it is
  // already open at 03:01Z and one hour later is 04:01Z.
  it.each`
    disambiguation
    ${"compatible"}
    ${"earlier"}
  `(
    "$disambiguation: one open hour from 2010-11-07T03:01:00Z ends at 2010-11-07T04:01:00Z",
    ({ disambiguation }) => {
      const schedule = {
        timeZone: "America/Goose_Bay",
        weekly: {
          1: [{ from: "22:00", to: "02:00" }],
          3: [{ from: "23:00", to: "06:00" }],
          5: [{ from: "20:00", to: "03:00" }],
          7: [{ from: "00:00", to: "00:00" }],
        },
      };
      expect(
        addOperatingTime("2010-11-07T03:01:00Z", "PT1H", schedule, {
          disambiguation,
        }),
      ).toBe("2010-11-07T04:01:00Z");
    },
  );
});

describe("addOperatingTime when a clock change repeats local midnight and the window never closes", () => {
  // Every day is open 00:00 to 00:00, so open time is elapsed time. The fall-back repeats
  // midnight, so the next date starts at or before the start instant; the count must still
  // begin at the start instant, never earlier.
  const allDay = Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7].map((day) => [day, [{ from: "00:00", to: "00:00" }]]),
  );

  it.each`
    timeZone               | start                     | amount     | expected
    ${"America/St_Johns"}  | ${"2010-11-07T03:00:00Z"} | ${"PT1H"}  | ${"2010-11-07T04:00:00Z"}
    ${"America/St_Johns"}  | ${"2010-11-07T03:00:00Z"} | ${"PT20H"} | ${"2010-11-07T23:00:00Z"}
    ${"America/St_Johns"}  | ${"2010-11-07T02:45:00Z"} | ${"PT1H"}  | ${"2010-11-07T03:45:00Z"}
    ${"America/Goose_Bay"} | ${"2010-11-07T03:30:00Z"} | ${"PT1H"}  | ${"2010-11-07T04:30:00Z"}
    ${"America/Moncton"}   | ${"2005-10-30T03:30:00Z"} | ${"PT1H"}  | ${"2005-10-30T04:30:00Z"}
  `(
    "$timeZone: $amount from $start ends at $expected",
    ({ timeZone, start, amount, expected }) => {
      expect(
        addOperatingTime(start, amount, { timeZone, weekly: allDay }),
      ).toBe(expected);
    },
  );
});

describe("addOperatingTime when a rejected window lies beyond the last whole-day probe", () => {
  // New York springs forward on Sunday 2024-03-10, so the Sunday 02:30-03:30 window has a
  // nonexistent start and `"reject"` refuses to guess it. Starting Saturday 03-02, the day jumps
  // read the days before 03-10 as clean (8 h on each of Mon to Fri) and the one after as refused;
  // the answer is unknowable either way, so the sentinel.
  it("returns the sentinel for 100 open hours from 2024-03-02 under reject", () => {
    const schedule = {
      timeZone: "America/New_York",
      weekly: {
        1: [{ from: "09:00", to: "17:00" }],
        2: [{ from: "09:00", to: "17:00" }],
        3: [{ from: "09:00", to: "17:00" }],
        4: [{ from: "09:00", to: "17:00" }],
        5: [{ from: "09:00", to: "17:00" }],
        7: [{ from: "02:30", to: "03:30" }],
      },
    };
    expect(
      addOperatingTime("2024-03-02T12:00:00Z", "PT100H", schedule, {
        disambiguation: "reject",
        within: "P12D",
      }),
    ).toBe("");
  });
});
