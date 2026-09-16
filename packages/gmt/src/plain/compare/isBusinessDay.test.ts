import { battleTestTimeZones } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { isBusinessDay } from "./isBusinessDay";

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
const sundayOnly = { weekend: [7], holidays: [], timeZone: "UTC" };
const noWeeklyClosure = {
  weekend: [],
  holidays: ["2024-07-04"],
  timeZone: "UTC",
};
const satSunNoHolidays = { weekend: [6, 7], holidays: [], timeZone: "UTC" };

describe("isBusinessDay", () => {
  // Full week boundary coverage — fixed ISO Monday–Friday business days.
  it.each`
    value           | expected
    ${"2024-02-02"} | ${true}
    ${"2024-02-03"} | ${false}
    ${"2024-02-04"} | ${false}
    ${"2024-02-05"} | ${true}
    ${"2024-02-06"} | ${true}
    ${"2024-02-07"} | ${true}
    ${"2024-02-08"} | ${true}
  `(
    "returns $expected for $value (Mon–Fri business day)",
    ({ value, expected }) => {
      expect(isBusinessDay(value)).toBe(expected);
    },
  );

  // Leap year edge cases — Feb 29 falls on different weekdays across years.
  it.each`
    value           | expected | description
    ${"2024-02-29"} | ${true}  | ${"Thursday"}
    ${"2025-02-29"} | ${false} | ${"Saturday"}
  `(
    "returns $expected for $value (on a $description)",
    ({ value, expected }) => {
      expect(isBusinessDay(value)).toBe(expected);
    },
  );

  // Year-boundary dates — extreme years that happen to fall on Mon/Fri.
  it.each`
    value           | expected | description
    ${"0001-01-01"} | ${true}  | ${"Monday"}
    ${"9999-12-31"} | ${true}  | ${"Friday"}
  `(
    "returns $expected for $value (on a $description)",
    ({ value, expected }) => {
      expect(isBusinessDay(value)).toBe(expected);
    },
  );

  // Cross-year weekend consistency — Saturdays and Sundays in different years.
  it.each`
    value           | expected | description
    ${"2025-01-04"} | ${false} | ${"Saturday"}
    ${"2026-01-03"} | ${false} | ${"Sunday"}
    ${"2025-01-05"} | ${false} | ${"Monday"}
  `("returns $expected for $value $description", ({ value, expected }) => {
    expect(isBusinessDay(value)).toBe(expected);
  });

  // A holiday is not a working day even midweek; a weekend day never is.
  it.each`
    value           | expected | description
    ${"2024-07-03"} | ${true}  | ${"Wednesday"}
    ${"2024-07-04"} | ${false} | ${"Thursday, a holiday"}
    ${"2024-07-05"} | ${true}  | ${"Friday"}
    ${"2024-07-06"} | ${false} | ${"Saturday"}
    ${"2024-07-07"} | ${false} | ${"Sunday"}
  `(
    "returns $expected for $value ($description) under a Sat-Sun calendar with a holiday",
    ({ value, expected }) => {
      expect(isBusinessDay(value, usIndependence)).toBe(expected);
    },
  );

  // Friday-Saturday weekend: Sunday works, Friday does not.
  it.each`
    value           | expected | description
    ${"2024-07-04"} | ${true}  | ${"Thursday"}
    ${"2024-07-05"} | ${false} | ${"Friday, weekend here"}
    ${"2024-07-06"} | ${false} | ${"Saturday, weekend here"}
    ${"2024-07-07"} | ${true}  | ${"Sunday, a working day here"}
    ${"2024-07-08"} | ${true}  | ${"Monday"}
  `(
    "returns $expected for $value ($description) under a Friday-Saturday calendar",
    ({ value, expected }) => {
      expect(isBusinessDay(value, fridaySaturday)).toBe(expected);
    },
  );

  // One-day weekend, and no weekly closure at all.
  it.each`
    value           | calendar           | expected | description
    ${"2024-07-06"} | ${sundayOnly}      | ${true}  | ${"Saturday works under a Sunday-only weekend"}
    ${"2024-07-07"} | ${sundayOnly}      | ${false} | ${"Sunday is the only closure"}
    ${"2024-07-06"} | ${noWeeklyClosure} | ${true}  | ${"Saturday works with no weekly closure"}
    ${"2024-07-07"} | ${noWeeklyClosure} | ${true}  | ${"Sunday works with no weekly closure"}
    ${"2024-07-04"} | ${noWeeklyClosure} | ${false} | ${"the holiday still closes"}
  `(
    "returns $expected for $value — $description",
    ({ value, calendar, expected }) => {
      expect(isBusinessDay(value, calendar)).toBe(expected);
    },
  );

  // Omitting the calendar and passing one that spells out the old default must agree.
  it.each`
    value           | expected
    ${"2024-07-05"} | ${true}
    ${"2024-07-06"} | ${false}
    ${"2024-07-07"} | ${false}
    ${"2024-07-08"} | ${true}
  `(
    "treats an absent calendar and an explicit Sat-Sun calendar alike for $value",
    ({ value, expected }) => {
      expect(isBusinessDay(value)).toBe(expected);
      expect(isBusinessDay(value, satSunNoHolidays)).toBe(expected);
    },
  );

  // A holiday list that never mentions the date under test changes nothing.
  it.each`
    value           | expected | description
    ${"2024-07-03"} | ${true}  | ${"Wednesday"}
    ${"2024-07-06"} | ${false} | ${"Saturday"}
  `(
    "returns $expected for $value ($description) when the holidays are all elsewhere",
    ({ value, expected }) => {
      expect(
        isBusinessDay(value, {
          weekend: [6, 7],
          holidays: ["2024-12-25"],
          timeZone: "UTC",
        }),
      ).toBe(expected);
    },
  );

  // calendar.timeZone records locality; it never changes the answer for a local date.
  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "gives the same answer whatever calendar.timeZone says ($timeZone)",
    ({ timeZone }) => {
      expect(isBusinessDay("2024-07-04", { ...usIndependence, timeZone })).toBe(
        false,
      );
      expect(isBusinessDay("2024-07-05", { ...usIndependence, timeZone })).toBe(
        true,
      );
    },
  );

  it.each`
    calendar                                                             | description
    ${{ weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }}       | ${"an unknown timeZone"}
    ${{ weekend: [1, 2, 3, 4, 5, 6, 7], holidays: [], timeZone: "UTC" }} | ${"no business day at all"}
    ${{ weekend: [6, 8], holidays: [], timeZone: "UTC" }}                | ${"a weekday out of range"}
    ${{ weekend: [6, 7], holidays: ["2024-02-30"], timeZone: "UTC" }}    | ${"a holiday that does not exist"}
    ${{ weekend: [6, 7], holidays: "2024-07-04", timeZone: "UTC" }}      | ${"holidays that are not an array"}
    ${{}}                                                                | ${"no fields"}
    ${null}                                                              | ${"null"}
    ${"UTC"}                                                             | ${"a string"}
  `(
    "returns false for a Wednesday when the calendar has $description",
    ({ calendar }) => {
      expect(isBusinessDay("2024-07-03", calendar as never)).toBe(false);
    },
  );

  it.each`
    value
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${""}
    ${"   "}
    ${" 2024-02-05 "}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns false for invalid value $value", ({ value }) => {
    expect(isBusinessDay(value)).toBe(false);
  });

  it("returns false when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(isBusinessDay("2024-02-05")).toBe(false);
  });
});
