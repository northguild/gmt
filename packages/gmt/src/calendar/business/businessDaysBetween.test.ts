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

  // From a non-business start the inverse holds only for n >= 0. Walking back n business days
  // from a weekend lands on the nth business day before it, and (end, start] then holds only
  // n − 1 of them, because start itself is not a business day. Hand count, Sat–Sun weekend:
  // 6 Jul (Sat) −1 → Fri 5, and (5, 6] is just Saturday, so 0; 6 Jul −5 → Mon 1, (1, 6] holds
  // Tue–Fri, so −4; 7 Jul (Sun) −3 → Wed 3, (3, 7] holds Thu and Fri, so −2; 6 Jul +1 → Mon 8,
  // (6, 8] holds Monday, so 1.
  it.each`
    start           | amount | end             | expected
    ${"2024-07-06"} | ${-1}  | ${"2024-07-05"} | ${0}
    ${"2024-07-06"} | ${-5}  | ${"2024-07-01"} | ${-4}
    ${"2024-07-07"} | ${-3}  | ${"2024-07-03"} | ${-2}
    ${"2024-07-06"} | ${1}   | ${"2024-07-08"} | ${1}
    ${"2024-07-06"} | ${5}   | ${"2024-07-12"} | ${5}
  `(
    "counts $expected, not $amount, from weekend start $start to addBusinessDays' $end",
    ({ start, amount, end, expected }) => {
      expect(addBusinessDays(start, amount, satSunNoHolidays)).toBe(end);
      expect(
        Object.is(businessDaysBetween(start, end, satSunNoHolidays), expected),
      ).toBe(true);
    },
  );

  // A reversed range with no business days is 0, never IEEE 754 negative zero, which
  // Object.is and toBe tell apart from 0.
  it.each`
    start           | end             | description
    ${"2024-07-06"} | ${"2024-07-05"} | ${"(Fri, Sat] holds only Saturday"}
    ${"2024-07-07"} | ${"2024-07-06"} | ${"(Sat, Sun] holds only Sunday"}
    ${"2024-07-07"} | ${"2024-07-05"} | ${"(Fri, Sun] holds only the weekend"}
  `(
    "returns positive 0 for reversed $start to $end — $description",
    ({ start, end, description }) => {
      const result = businessDaysBetween(start, end, satSunNoHolidays);
      expect(Object.is(result, 0), description).toBe(true);
    },
  );

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
