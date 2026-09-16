import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../test";
import {
  businessDateFrom,
  DEFAULT_BUSINESS_CALENDAR,
  isBusinessDate,
  MAX_BUSINESS_DAY_STEPS,
  parseBusinessCalendar,
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
      holidays: new Set(["2024-07-04"]),
    });
  });

  it("normalises holidays through Temporal so they compare as walked dates do", () => {
    expect(
      resolved({
        weekend: [6, 7],
        holidays: ["+002024-07-04", "2024-07-04"],
        timeZone: "UTC",
      }).holidays,
    ).toEqual(new Set(["2024-07-04"]));
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
      holidays: new Set(),
    });
  });

  it("parses anything else, sentinel included", () => {
    expect(resolveBusinessCalendar(usIndependence)).toEqual({
      weekend: new Set([6, 7]),
      holidays: new Set(["2024-07-04"]),
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
