import { addBusinessDays } from "../../plain/calculate";
import { battleTestTimeZones } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { businessDaysBetween } from "./businessDaysBetween";

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

describe("businessDaysBetween", () => {
  // `start` is excluded and `end` included, so each row counts the dates after start up to
  // and including end.
  it.each`
    start           | end             | expected | description
    ${"2024-07-01"} | ${"2024-07-05"} | ${3}     | ${"Tue, Wed, Fri — Thu is the holiday"}
    ${"2024-07-01"} | ${"2024-07-08"} | ${4}     | ${"Tue, Wed, Fri, Mon"}
    ${"2024-07-05"} | ${"2024-07-08"} | ${1}     | ${"Mon only, over the weekend"}
    ${"2024-07-03"} | ${"2024-07-04"} | ${0}     | ${"the holiday alone"}
    ${"2024-07-04"} | ${"2024-07-05"} | ${1}     | ${"Fri, counted from the holiday"}
    ${"2024-07-01"} | ${"2024-07-02"} | ${1}     | ${"Tue alone"}
  `(
    "counts $expected business days in ($start, $end] — $description",
    ({ start, end, expected }) => {
      expect(businessDaysBetween(start, end, usIndependence)).toBe(expected);
    },
  );

  // An empty range is zero whether or not its endpoint is a working day.
  it.each`
    value           | description
    ${"2024-07-03"} | ${"a working day"}
    ${"2024-07-04"} | ${"a holiday"}
    ${"2024-07-06"} | ${"a Saturday"}
  `(
    "counts 0 when start and end are both $value ($description)",
    ({ value }) => {
      expect(businessDaysBetween(value, value, usIndependence)).toBe(0);
    },
  );

  // Reversing the endpoints negates the count.
  it.each`
    start           | end             | expected
    ${"2024-07-01"} | ${"2024-07-05"} | ${3}
    ${"2024-07-01"} | ${"2024-07-08"} | ${4}
    ${"2024-07-05"} | ${"2024-07-08"} | ${1}
  `(
    "negates the count of $expected for the reversed range ($end, $start]",
    ({ start, end, expected }) => {
      expect(businessDaysBetween(end, start, usIndependence)).toBe(-expected);
    },
  );

  // Weekends other than Saturday–Sunday, and none at all.
  it.each`
    start           | end             | calendar            | expected | description
    ${"2024-07-01"} | ${"2024-07-08"} | ${fridaySaturday}   | ${5}     | ${"Tue, Wed, Thu, Sun, Mon"}
    ${"2024-07-01"} | ${"2024-07-08"} | ${sundayOnly}       | ${6}     | ${"every day but Sunday"}
    ${"2024-07-01"} | ${"2024-07-08"} | ${noWeeklyClosure}  | ${6}     | ${"seven dates less the holiday"}
    ${"2024-07-01"} | ${"2024-07-08"} | ${satSunNoHolidays} | ${5}     | ${"Tue, Wed, Thu, Fri, Mon"}
  `(
    "counts $expected business days in ($start, $end] — $description",
    ({ start, end, calendar, expected }) => {
      expect(businessDaysBetween(start, end, calendar)).toBe(expected);
    },
  );

  // July 2024 has 23 Monday–Friday dates; excluding 1 July leaves 22.
  it("counts a whole month of weekdays", () => {
    expect(
      businessDaysBetween("2024-07-01", "2024-07-31", satSunNoHolidays),
    ).toBe(22);
  });

  // The count is the inverse of the walk: adding n business days to a date puts exactly n
  // business days in the half-open range it covers.
  it.each`
    amount
    ${1}
    ${5}
    ${7}
    ${23}
    ${-1}
    ${-5}
    ${-7}
    ${-23}
  `("agrees with addBusinessDays for $amount business days", ({ amount }) => {
    const end = addBusinessDays("2024-07-03", amount, usIndependence);
    expect(businessDaysBetween("2024-07-03", end, usIndependence)).toBe(amount);
  });

  // Counted, never walked — a 38-year range costs the same as a one-week one.
  it("counts a range far past any step cap", () => {
    expect(
      businessDaysBetween("2024-01-01", "2062-05-01", satSunNoHolidays),
    ).toBe(10000);
  });

  it.each`
    start                    | end             | description
    ${"invalid"}             | ${"2024-07-05"} | ${"an unparseable start"}
    ${"2024-07-01"}          | ${"invalid"}    | ${"an unparseable end"}
    ${"2024-02-30"}          | ${"2024-07-05"} | ${"a start that does not exist"}
    ${"2024-07-01T00:00:00"} | ${"2024-07-05"} | ${"a datetime start"}
    ${""}                    | ${"2024-07-05"} | ${"an empty start"}
    ${null}                  | ${"2024-07-05"} | ${"a null start"}
    ${"2024-07-01"}          | ${undefined}    | ${"an undefined end"}
    ${12}                    | ${"2024-07-05"} | ${"a numeric start"}
  `("returns null for $description", ({ start, end }) => {
    expect(
      businessDaysBetween(start as never, end as never, usIndependence),
    ).toBe(null);
  });

  it.each`
    calendar                                                             | description
    ${{ weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }}       | ${"an unknown timeZone"}
    ${{ weekend: [1, 2, 3, 4, 5, 6, 7], holidays: [], timeZone: "UTC" }} | ${"no business day at all"}
    ${{ weekend: [6, 8], holidays: [], timeZone: "UTC" }}                | ${"a weekday out of range"}
    ${{ weekend: [6, 7], holidays: ["2024-02-30"], timeZone: "UTC" }}    | ${"a holiday that does not exist"}
    ${{}}                                                                | ${"no fields"}
    ${null}                                                              | ${"null"}
    ${undefined}                                                         | ${"undefined"}
  `("returns null when the calendar has $description", ({ calendar }) => {
    expect(
      businessDaysBetween("2024-07-01", "2024-07-05", calendar as never),
    ).toBe(null);
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      businessDaysBetween("2024-07-01", "2024-07-05", usIndependence),
    ).toBe(null);
  });

  // calendar.timeZone records locality; it never changes the count for two local dates.
  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "gives the same count whatever calendar.timeZone says ($timeZone)",
    ({ timeZone }) => {
      expect(
        businessDaysBetween("2024-07-01", "2024-07-05", {
          ...usIndependence,
          timeZone,
        }),
      ).toBe(3);
    },
  );
});
