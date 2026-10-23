import { epochDayOf, MAX_EPOCH_DAY } from "./epochDay";
import { Temporal } from "./temporal";
import { battleTestTimeZones } from "../test";
import {
  businessDateFrom,
  clearHolidayMemo,
  DEFAULT_BUSINESS_CALENDAR,
  isBusinessDate,
  MAX_BUSINESS_DAY_STEPS,
  nextBusinessEpochDay,
  parseBusinessCalendar,
  parseHolidays,
  resolveBusinessCalendar,
  stepBusinessDates,
} from "./businessCalendar";

const date = (value: string) => Temporal.PlainDate.from(value);

// July 2024: 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat, 7 Sun, 8 Mon.
const usIndependence = {
  weekend: [6, 7],
  holidays: ["2024-07-04"],
  timeZone: "America/New_York",
};
const fridaySaturday = {
  weekend: [5, 6],
  holidays: [],
  timeZone: "Asia/Riyadh",
};

const resolved = (calendar: unknown) => {
  const value = parseBusinessCalendar(calendar);

  if (value === null) {
    throw new Error("expected a valid calendar");
  }

  return value;
};

// 2024-01-01 is a Monday. Exactly 142,858 Saturday–Sunday business days fall inside the
// 200,000 calendar days the cap allows, the last of them 2571-08-01.
const CAP_BUSINESS_DAYS = 142_858;

describe("parseBusinessCalendar", () => {
  it("reduces a calendar to its two lookups and drops timeZone", () => {
    expect(parseBusinessCalendar(usIndependence)).toEqual({
      weekend: new Set([6, 7]),
      holidays: new Int32Array([19_908]),
      closures: new Int32Array([19_908]),
    });
  });

  it("normalises holidays through Temporal so they compare as walked dates do", () => {
    expect(
      resolved({
        weekend: [6, 7],
        holidays: ["+002024-07-04", "2024-07-04"],
        timeZone: "UTC",
      }).holidays,
    ).toEqual(new Int32Array([19_908]));
  });

  it("de-duplicates a repeated weekend day", () => {
    expect(
      resolved({ weekend: [6, 6, 7], holidays: [], timeZone: "UTC" }).weekend,
    ).toEqual(new Set([6, 7]));
  });

  it.each`
    candidate                                                            | description
    ${{ weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }}       | ${"an unknown timeZone"}
    ${{ weekend: [6, 7], holidays: [] }}                                 | ${"no timeZone"}
    ${{ weekend: [6, 7], holidays: [], timeZone: 12 }}                   | ${"a non-string timeZone"}
    ${{ weekend: [1, 2, 3, 4, 5, 6, 7], holidays: [], timeZone: "UTC" }} | ${"no business day at all"}
    ${{ weekend: [0], holidays: [], timeZone: "UTC" }}                   | ${"a weekday below range"}
    ${{ weekend: [8], holidays: [], timeZone: "UTC" }}                   | ${"a weekday above range"}
    ${{ weekend: [6.5], holidays: [], timeZone: "UTC" }}                 | ${"a fractional weekday"}
    ${{ weekend: 6, holidays: [], timeZone: "UTC" }}                     | ${"a weekend that is not an array"}
    ${{ weekend: [6, 7], holidays: "2024-07-04", timeZone: "UTC" }}      | ${"holidays that are not an array"}
    ${{ weekend: [6, 7], holidays: ["2024-02-30"], timeZone: "UTC" }}    | ${"a holiday that does not exist"}
    ${{ weekend: [6, 7], holidays: [20240704], timeZone: "UTC" }}        | ${"a numeric holiday"}
    ${{}}                                                                | ${"no fields"}
    ${[]}                                                                | ${"an array"}
    ${null}                                                              | ${"null"}
    ${undefined}                                                         | ${"undefined"}
    ${"UTC"}                                                             | ${"a string"}
  `("returns null for $description", ({ candidate }) => {
    expect(parseBusinessCalendar(candidate)).toBe(null);
  });

  // The field records locality only — nothing downstream can reach it.
  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "produces the same lookups whatever timeZone says ($timeZone)",
    ({ timeZone }) => {
      expect(parseBusinessCalendar({ ...usIndependence, timeZone })).toEqual(
        parseBusinessCalendar(usIndependence),
      );
    },
  );
});

describe("resolveBusinessCalendar", () => {
  it("treats an absent calendar as the Saturday–Sunday default", () => {
    expect(resolveBusinessCalendar(undefined)).toBe(DEFAULT_BUSINESS_CALENDAR);
    expect(DEFAULT_BUSINESS_CALENDAR).toEqual({
      weekend: new Set([6, 7]),
      holidays: new Int32Array(0),
      closures: new Int32Array(0),
    });
  });

  it("parses anything else, sentinel included", () => {
    expect(resolveBusinessCalendar(usIndependence)).toEqual({
      weekend: new Set([6, 7]),
      holidays: new Int32Array([19_908]),
      closures: new Int32Array([19_908]),
    });
    expect(resolveBusinessCalendar({} as never)).toBe(null);
  });
});

describe("isBusinessDate", () => {
  it.each`
    value           | expected | description
    ${"2024-07-03"} | ${true}  | ${"Wednesday"}
    ${"2024-07-04"} | ${false} | ${"Thursday, a holiday"}
    ${"2024-07-05"} | ${true}  | ${"Friday"}
    ${"2024-07-06"} | ${false} | ${"Saturday"}
    ${"2024-07-07"} | ${false} | ${"Sunday"}
  `("returns $expected for $value ($description)", ({ value, expected }) => {
    expect(isBusinessDate(date(value), resolved(usIndependence))).toBe(
      expected,
    );
  });

  it.each`
    value           | expected | description
    ${"2024-07-05"} | ${false} | ${"Friday, weekend here"}
    ${"2024-07-07"} | ${true}  | ${"Sunday, a working day here"}
  `(
    "returns $expected for $value under a Friday–Saturday week ($description)",
    ({ value, expected }) => {
      expect(isBusinessDate(date(value), resolved(fridaySaturday))).toBe(
        expected,
      );
    },
  );
});

describe("businessDateFrom", () => {
  // On or at: a working day is returned unchanged, whichever way the walk runs.
  it.each`
    value           | direction | expected        | description
    ${"2024-07-03"} | ${1}      | ${"2024-07-03"} | ${"already a working day"}
    ${"2024-07-03"} | ${-1}     | ${"2024-07-03"} | ${"already a working day, backwards"}
    ${"2024-07-04"} | ${1}      | ${"2024-07-05"} | ${"forward off the holiday"}
    ${"2024-07-04"} | ${-1}     | ${"2024-07-03"} | ${"backward off the holiday"}
    ${"2024-07-06"} | ${1}      | ${"2024-07-08"} | ${"forward off a Saturday"}
    ${"2024-07-07"} | ${-1}     | ${"2024-07-05"} | ${"backward off a Sunday"}
  `(
    "rolls $value in direction $direction to $expected — $description",
    ({ value, direction, expected }) => {
      expect(
        businessDateFrom(
          date(value),
          direction,
          resolved(usIndependence),
        )?.toString(),
      ).toBe(expected);
    },
  );

  it("walks over a bridged closure until it finds a working day", () => {
    const bridged = resolved({
      weekend: [6, 7],
      holidays: ["2024-07-04", "2024-07-05"],
      timeZone: "America/New_York",
    });

    expect(businessDateFrom(date("2024-07-04"), 1, bridged)?.toString()).toBe(
      "2024-07-08",
    );
  });
  it.each`
    value              | direction | expected
    ${"+275760-09-13"} | ${-1}     | ${"+275760-09-12"}
    ${"-271821-04-19"} | ${1}      | ${"-271821-04-19"}
  `(
    "rolls $value in direction $direction to $expected at the range limit",
    ({ value, direction, expected }) => {
      expect(
        businessDateFrom(
          date(value),
          direction,
          DEFAULT_BUSINESS_CALENDAR,
        )?.toString(),
      ).toBe(expected);
    },
  );

  it("throws a RangeError when the roll runs past the maximum", () => {
    expect(() =>
      businessDateFrom(date("+275760-09-13"), 1, DEFAULT_BUSINESS_CALENDAR),
    ).toThrow(RangeError);
  });

  // A 60-day closure: one Temporal operation per closed day would be well over the bound.
  it("rolls over a long closure without a Temporal operation per calendar day", () => {
    const closure = resolved({
      weekend: [6, 7],
      holidays: Array.from({ length: 60 }, (_, index) =>
        date("2024-07-01").add({ days: index }).toString(),
      ),
      timeZone: "UTC",
    });
    const add = vi.spyOn(Temporal.PlainDate.prototype, "add");
    const dayOfWeek = vi.spyOn(
      Temporal.PlainDate.prototype,
      "dayOfWeek",
      "get",
    );
    const toString = vi.spyOn(Temporal.PlainDate.prototype, "toString");

    expect(businessDateFrom(date("2024-07-01"), 1, closure)?.toString()).toBe(
      "2024-08-30",
    );

    const calls =
      add.mock.calls.length +
      dayOfWeek.mock.calls.length +
      toString.mock.calls.length;

    // The assertion's own `toString` is one of them.
    expect(calls).toBeLessThan(10);
  });
});

describe("stepBusinessDates", () => {
  // `date` itself is never counted, so 0 returns it unchanged even on a closed day.
  it.each`
    value           | direction | count | expected
    ${"2024-07-03"} | ${1}      | ${0}  | ${"2024-07-03"}
    ${"2024-07-06"} | ${1}      | ${0}  | ${"2024-07-06"}
    ${"2024-07-06"} | ${-1}     | ${0}  | ${"2024-07-06"}
  `(
    "returns $value unchanged for a count of $count",
    ({ value, direction, count, expected }) => {
      expect(
        stepBusinessDates(
          date(value),
          direction,
          count,
          resolved(usIndependence),
        )?.toString(),
      ).toBe(expected);
    },
  );

  // 2024-02-29 is a Thursday, 2024-03-08 a Friday — the default Saturday–Sunday week.
  it.each`
    value           | direction | count  | expected
    ${"2024-02-29"} | ${1}      | ${1}   | ${"2024-03-01"}
    ${"2024-02-29"} | ${1}      | ${2}   | ${"2024-03-04"}
    ${"2024-02-29"} | ${1}      | ${6}   | ${"2024-03-08"}
    ${"2024-02-29"} | ${1}      | ${20}  | ${"2024-03-28"}
    ${"2024-02-29"} | ${1}      | ${100} | ${"2024-07-18"}
    ${"2024-02-29"} | ${1}      | ${200} | ${"2024-12-05"}
    ${"2024-03-08"} | ${1}      | ${1}   | ${"2024-03-11"}
    ${"2024-03-08"} | ${1}      | ${10}  | ${"2024-03-22"}
    ${"2024-02-29"} | ${-1}     | ${1}   | ${"2024-02-28"}
    ${"2024-02-29"} | ${-1}     | ${4}   | ${"2024-02-23"}
    ${"2024-02-29"} | ${-1}     | ${20}  | ${"2024-02-01"}
    ${"2024-02-29"} | ${-1}     | ${100} | ${"2023-10-12"}
    ${"2024-02-29"} | ${-1}     | ${200} | ${"2023-05-25"}
    ${"2024-03-08"} | ${-1}     | ${5}   | ${"2024-03-01"}
    ${"2024-03-08"} | ${-1}     | ${10}  | ${"2024-02-23"}
  `(
    "steps $count business days from $value in direction $direction to $expected",
    ({ value, direction, count, expected }) => {
      expect(
        stepBusinessDates(
          date(value),
          direction,
          count,
          DEFAULT_BUSINESS_CALENDAR,
        )?.toString(),
      ).toBe(expected);
    },
  );

  // A negative count names no walk: it gives up with the sentinel, as the day-by-day loop did.
  it.each`
    direction | count
    ${1}      | ${-1}
    ${-1}     | ${-3}
  `(
    "returns null for a count of $count in direction $direction",
    ({ direction, count }) => {
      expect(
        stepBusinessDates(
          date("2024-07-03"),
          direction,
          count,
          DEFAULT_BUSINESS_CALENDAR,
        ),
      ).toBe(null);
    },
  );

  it("skips the calendar's holidays as well as its weekend", () => {
    expect(
      stepBusinessDates(
        date("2024-07-03"),
        1,
        1,
        resolved(usIndependence),
      )?.toString(),
    ).toBe("2024-07-05");
  });

  // The cap is the whole point of the bounded loop: the longest walk that fits still
  // converges, and one business day more returns the sentinel rather than a partial walk.
  it("returns the last date that fits inside the cap", () => {
    expect(MAX_BUSINESS_DAY_STEPS).toBe(200_000);
    expect(
      stepBusinessDates(
        date("2024-01-01"),
        1,
        CAP_BUSINESS_DAYS,
        DEFAULT_BUSINESS_CALENDAR,
      )?.toString(),
    ).toBe("2571-08-01");
  });

  // TC39 ISODateWithinLimits: +275760-09-13 (a Saturday) is the last PlainDate and
  // -271821-04-19 (a Monday) the first. A step beyond either is a RangeError, as `add` throws;
  // the public callers turn it into their sentinel.
  it.each`
    value              | direction | count | expected
    ${"+275760-09-12"} | ${-1}     | ${1}  | ${"+275760-09-11"}
    ${"+275760-09-10"} | ${1}      | ${2}  | ${"+275760-09-12"}
    ${"-271821-04-20"} | ${-1}     | ${1}  | ${"-271821-04-19"}
    ${"-271821-04-19"} | ${1}      | ${1}  | ${"-271821-04-20"}
  `(
    "steps $count business days from $value in direction $direction to $expected at the range limit",
    ({ value, direction, count, expected }) => {
      expect(
        stepBusinessDates(
          date(value),
          direction,
          count,
          DEFAULT_BUSINESS_CALENDAR,
        )?.toString(),
      ).toBe(expected);
    },
  );

  it.each`
    value              | direction | count | description
    ${"+275760-09-12"} | ${1}      | ${1}  | ${"the Saturday limit is closed, so the walk steps past it"}
    ${"+275760-09-13"} | ${1}      | ${1}  | ${"already at the maximum"}
    ${"-271821-04-19"} | ${-1}     | ${1}  | ${"already at the minimum"}
    ${"-271821-04-22"} | ${-1}     | ${4}  | ${"only three business days lie at or after the minimum"}
  `(
    "throws a RangeError stepping $count from $value in direction $direction — $description",
    ({ value, direction, count }) => {
      expect(() =>
        stepBusinessDates(
          date(value),
          direction,
          count,
          DEFAULT_BUSINESS_CALENDAR,
        ),
      ).toThrow(RangeError);
    },
  );

  // The walks count ISO days; a date in another calendar would walk from the wrong day.
  it("throws a RangeError for a date that is not in the ISO calendar", () => {
    const hebrew = Temporal.PlainDate.from("2024-03-15").withCalendar("hebrew");
    expect(() =>
      stepBusinessDates(hebrew, 1, 1, DEFAULT_BUSINESS_CALENDAR),
    ).toThrow(RangeError);
    expect(() =>
      businessDateFrom(hebrew, 1, DEFAULT_BUSINESS_CALENDAR),
    ).toThrow(RangeError);
  });

  // The cap test above timed out on CI when every calendar day built a PlainDate through the
  // polyfill. The walk is integer arithmetic; only the result is a Temporal object.
  it("reaches the cap without a Temporal operation per calendar day walked", () => {
    const add = vi.spyOn(Temporal.PlainDate.prototype, "add");
    const dayOfWeek = vi.spyOn(
      Temporal.PlainDate.prototype,
      "dayOfWeek",
      "get",
    );
    const toString = vi.spyOn(Temporal.PlainDate.prototype, "toString");

    stepBusinessDates(
      date("2024-01-01"),
      1,
      CAP_BUSINESS_DAYS + 1,
      resolved(usIndependence),
    );

    const calls =
      add.mock.calls.length +
      dayOfWeek.mock.calls.length +
      toString.mock.calls.length;

    expect(calls).toBeLessThan(10);
  });

  it("returns null rather than a partial walk once the cap is exceeded", () => {
    expect(
      stepBusinessDates(
        date("2024-01-01"),
        1,
        CAP_BUSINESS_DAYS + 1,
        DEFAULT_BUSINESS_CALENDAR,
      ),
    ).toBe(null);
  });
});

// 2024-01-01 is epoch day 19,723 (Monday); 2024-07-04 is 185 days on, 19,908 (Thursday).
describe("parseHolidays", () => {
  it("reads one epoch day for three spellings of the same ISO date", () => {
    expect(
      parseHolidays([
        "2024-07-04",
        "+002024-07-04",
        "2024-07-04[u-ca=iso8601]",
      ]),
    ).toEqual(new Int32Array([19_908]));
  });

  // 2024-12-25 is day 359 of a leap year: 19,723 + 359.
  it("sorts a list written out of date order", () => {
    expect(parseHolidays(["2024-12-25", "2024-01-01"])).toEqual(
      new Int32Array([19_723, 20_082]),
    );
  });

  it.each`
    holidays                        | description
    ${["2024-07-04[u-ca=hebrew]"]}  | ${"a holiday in another calendar"}
    ${["2024-07-04T10:00"]}         | ${"a holiday with a time"}
    ${[20_240_704]}                 | ${"a numeric holiday"}
    ${"2024-07-04"}                 | ${"holidays that are not an array"}
    ${["2024-07-04", "not a date"]} | ${"one bad holiday after a good one"}
  `("returns null for $description", ({ holidays }) => {
    expect(parseHolidays(holidays)).toBe(null);
  });

  it("reaches Temporal.PlainDate.from zero times for a list it has already read", () => {
    const list = ["2024-12-25", "2024-01-01", "2024-07-04"];

    clearHolidayMemo();

    const first = parseHolidays(list);
    const from = vi.spyOn(Temporal.PlainDate, "from");
    const second = parseHolidays(list);

    expect(second).toEqual(first);
    expect(from).not.toHaveBeenCalled();
    from.mockRestore();
  });

  // 65,536 strings fit; the 65,537th clears the memo before it is stored, so only then is the
  // first string parsed again.
  it("keeps 65,536 strings and clears on the 65,537th", () => {
    clearHolidayMemo();

    const epoch = Temporal.PlainDate.from("1970-01-01");
    const dates = Array.from({ length: 65_537 }, (_, day) =>
      epoch.add({ days: day }).toString(),
    );

    parseHolidays(dates.slice(0, 65_536));

    const from = vi.spyOn(Temporal.PlainDate, "from");

    try {
      expect(parseHolidays([dates[0], dates[65_535]])).toEqual(
        new Int32Array([0, 65_535]),
      );
      expect(from).not.toHaveBeenCalled();

      parseHolidays([dates[65_536]]);
      from.mockClear();

      expect(parseHolidays([dates[65_536]])).toEqual(new Int32Array([65_536]));
      expect(from).not.toHaveBeenCalled();
      expect(parseHolidays([dates[0]])).toEqual(new Int32Array([0]));
      expect(from).toHaveBeenCalled();
    } finally {
      from.mockRestore();
    }
  });

  // Epoch days 0 .. 65,536 are 65,537 distinct ISO dates; the first is evicted by the clear.
  it("still answers correctly after the memo is cleared at its bound", () => {
    clearHolidayMemo();

    const epoch = Temporal.PlainDate.from("1970-01-01");
    const dates = Array.from({ length: 65_537 }, (_, day) =>
      epoch.add({ days: day }).toString(),
    );

    expect(parseHolidays(dates)?.[65_536]).toBe(65_536);
    expect(parseHolidays(["1970-01-01"])).toEqual(new Int32Array([0]));
  });
});

describe("closures", () => {
  // Saturday 2024-07-06 is already closed by the weekend; Thursday 2024-07-04 is not.
  it("keeps only the holidays that fall on a working weekday", () => {
    expect(
      resolved({
        weekend: [6, 7],
        holidays: ["2024-07-06", "2024-07-04"],
        timeZone: "UTC",
      }).closures,
    ).toEqual(new Int32Array([19_908]));
  });
});

describe("walks at the cap and the limits", () => {
  const sundayOnlyOpen = { weekend: [1, 2, 3, 4, 5, 6], timeZone: "UTC" };
  // 2024-06-30 is a Sunday, epoch day 19,904. Sundays within the next 200,000 days are
  // 7k for k = 1 .. 28,571 (7 * 28,571 = 199,997), so 28,571 dates.
  const sundays = Array.from({ length: 28_571 }, (_, index) =>
    date("2024-06-30")
      .add({ days: 7 * (index + 1) })
      .toString(),
  );

  it("steps off the end of the Temporal range with a RangeError", () => {
    expect(() =>
      stepBusinessDates(
        date("+275760-09-05"),
        1,
        10,
        DEFAULT_BUSINESS_CALENDAR,
      ),
    ).toThrow(RangeError);
  });

  it("gives up at the cap when every reachable Sunday is a holiday", () => {
    expect(
      stepBusinessDates(
        date("2024-06-30"),
        1,
        1,
        resolved({ ...sundayOnlyOpen, holidays: sundays }),
      ),
    ).toBe(null);
  });

  // The last reachable day is 19,904 + 200,000; the final Sunday, 19,904 + 199,997, is
  // 2572-01-26 (a Sunday), and still counts.
  it("counts the last reachable Sunday when it is the one open day", () => {
    expect(
      stepBusinessDates(
        date("2024-06-30"),
        1,
        1,
        resolved({ ...sundayOnlyOpen, holidays: sundays.slice(0, -1) }),
      )?.toString(),
    ).toBe("2572-01-26");
  });

  // 2024-07-01 .. 2024-08-09 is 40 days; the next day, Monday 2024-08-12, is the first
  // weekday after the run (08-10 and 08-11 are the weekend).
  it("rolls past a run of 40 consecutive holidays", () => {
    const run = Array.from({ length: 40 }, (_, index) =>
      date("2024-07-01").add({ days: index }).toString(),
    );

    expect(
      businessDateFrom(
        date("2024-07-01"),
        1,
        resolved({ weekend: [6, 7], holidays: run, timeZone: "UTC" }),
      )?.toString(),
    ).toBe("2024-08-12");
  });
});

describe("nextBusinessEpochDay", () => {
  // July 2024: 4 Thu, 5 Fri, 6 Sat, 7 Sun, 8 Mon, 9 Tue.
  const jul = (day: number) => epochDayOf(2024, 7, day);
  const sat = (holidays: string[], weekend = [6, 7]) =>
    resolved({ weekend, holidays, timeZone: "UTC" });

  it.each`
    start     | weekend               | holidays                        | expected   | why
    ${jul(5)} | ${[6, 7]}             | ${[]}                           | ${jul(8)}  | ${"Friday over the weekend"}
    ${jul(3)} | ${[6, 7]}             | ${[]}                           | ${jul(4)}  | ${"strictly after: an open day itself is not returned"}
    ${jul(5)} | ${[6, 7]}             | ${["2024-07-08"]}               | ${jul(9)}  | ${"Monday closed by a holiday"}
    ${jul(5)} | ${[6, 7]}             | ${["2024-07-08", "2024-07-09"]} | ${jul(10)} | ${"two chained holidays"}
    ${jul(4)} | ${[5, 6]}             | ${[]}                           | ${jul(7)}  | ${"Friday-Saturday weekend, Sunday open"}
    ${jul(6)} | ${[1, 2, 3, 4, 5, 6]} | ${[]}                           | ${jul(7)}  | ${"six-day weekend, Sunday open"}
    ${jul(7)} | ${[1, 2, 3, 4, 5, 6]} | ${[]}                           | ${jul(14)} | ${"six-day weekend, next Sunday"}
  `(
    "$start gives $expected: $why",
    ({ start, weekend, holidays, expected }) => {
      expect(nextBusinessEpochDay(start, sat(holidays, weekend))).toBe(
        expected,
      );
    },
  );

  it("agrees with a one-day stepBusinessDates", () => {
    const calendar = sat(["2024-07-08"]);

    expect(nextBusinessEpochDay(jul(5), calendar)).toBe(epochDayOf(2024, 7, 9));
    expect(
      stepBusinessDates(date("2024-07-05"), 1, 1, calendar)?.toString(),
    ).toBe("2024-07-09");
  });

  it("returns null when the walk runs past the step bound", () => {
    // 2024-06-29 is a Saturday; every Sunday within the bound is closed (see the cap walk below).
    const sundays = Array.from({ length: 28_572 }, (_, index) =>
      date("2024-06-30")
        .add({ days: 7 * index })
        .toString(),
    );

    expect(
      nextBusinessEpochDay(
        epochDayOf(2024, 6, 29),
        sat(sundays, [1, 2, 3, 4, 5, 6]),
      ),
    ).toBeNull();
  });

  it("returns the maximum when it is the first open day", () => {
    expect(nextBusinessEpochDay(MAX_EPOCH_DAY - 1, sat([], []))).toBe(
      MAX_EPOCH_DAY,
    );
  });

  it.each`
    start                | why
    ${MAX_EPOCH_DAY}     | ${"from the maximum"}
    ${MAX_EPOCH_DAY - 1} | ${"the only later day is a closed Saturday"}
  `("throws RangeError past the Temporal range: $why", ({ start }) => {
    expect(() => nextBusinessEpochDay(start, sat([]))).toThrow(RangeError);
  });
});
