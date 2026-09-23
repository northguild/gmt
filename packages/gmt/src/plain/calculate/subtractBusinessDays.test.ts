import { battleTestTimeZones } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { subtractBusinessDays } from "./subtractBusinessDays";

const testDay = "2024-02-29";

// July 2024: 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat, 7 Sun, 8 Mon, 9 Tue.
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
const bridgedHoliday = {
  weekend: [6, 7],
  holidays: ["2024-07-04", "2024-07-05"],
  timeZone: "America/New_York",
};
const invalidCalendars = [
  { weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" },
  { weekend: [1, 2, 3, 4, 5, 6, 7], holidays: [], timeZone: "UTC" },
  { weekend: [6, 8], holidays: [], timeZone: "UTC" },
  { weekend: [6, 7], holidays: ["2024-02-30"], timeZone: "UTC" },
  {},
  null,
];

describe("subtractBusinessDays", () => {
  // Weekend and holidays are both skipped, backwards and forwards.
  it.each`
    value           | amount | expected        | description
    ${"2024-07-05"} | ${1}   | ${"2024-07-03"} | ${"Fri back over the Thu holiday to Wed"}
    ${"2024-07-08"} | ${2}   | ${"2024-07-03"} | ${"Mon back over weekend and holiday"}
    ${"2024-07-04"} | ${1}   | ${"2024-07-03"} | ${"from the holiday itself"}
    ${"2024-07-07"} | ${1}   | ${"2024-07-05"} | ${"from a Sunday"}
    ${"2024-07-03"} | ${-1}  | ${"2024-07-05"} | ${"a negative amount walks forwards"}
    ${"2024-07-03"} | ${-2}  | ${"2024-07-08"} | ${"forwards over holiday and weekend"}
  `(
    "returns $expected for $value - $amount business days — $description",
    ({ value, amount, expected }) => {
      expect(subtractBusinessDays(value, amount, usIndependence)).toBe(
        expected,
      );
    },
  );

  // Identity at zero holds even when the date is not itself a working day.
  it.each`
    value           | calendar          | description
    ${"2024-07-03"} | ${usIndependence} | ${"a working day"}
    ${"2024-07-04"} | ${usIndependence} | ${"a holiday"}
    ${"2024-07-07"} | ${usIndependence} | ${"a Sunday"}
    ${"2024-07-05"} | ${fridaySaturday} | ${"a Friday, weekend there"}
  `(
    "returns $value unchanged for an amount of 0 when $value is $description",
    ({ value, calendar }) => {
      expect(subtractBusinessDays(value, 0, calendar)).toBe(value);
    },
  );

  // Weekends other than Saturday-Sunday.
  it.each`
    value           | amount | calendar           | expected        | description
    ${"2024-07-07"} | ${1}   | ${fridaySaturday}  | ${"2024-07-04"} | ${"Sun back over Fri-Sat to Thu"}
    ${"2024-07-08"} | ${2}   | ${fridaySaturday}  | ${"2024-07-04"} | ${"Mon back to Thu"}
    ${"2024-07-04"} | ${-1}  | ${fridaySaturday}  | ${"2024-07-07"} | ${"negative walks forwards over Fri-Sat"}
    ${"2024-07-08"} | ${1}   | ${sundayOnly}      | ${"2024-07-06"} | ${"Sat is a working day"}
    ${"2024-07-06"} | ${1}   | ${sundayOnly}      | ${"2024-07-05"} | ${"only Sun closes"}
    ${"2024-07-05"} | ${1}   | ${noWeeklyClosure} | ${"2024-07-03"} | ${"holiday only, no weekend"}
    ${"2024-07-08"} | ${1}   | ${bridgedHoliday}  | ${"2024-07-03"} | ${"two holidays bridging into the weekend"}
  `(
    "returns $expected for $value - $amount business days — $description",
    ({ value, amount, calendar, expected }) => {
      expect(subtractBusinessDays(value, amount, calendar)).toBe(expected);
    },
  );

  // Omitting the calendar and spelling out the old default must agree.
  it.each`
    value           | amount | expected
    ${"2024-03-18"} | ${1}   | ${"2024-03-15"}
    ${"2024-03-18"} | ${-1}  | ${"2024-03-19"}
  `(
    "treats an absent calendar and an explicit Sat-Sun calendar alike for $value - $amount",
    ({ value, amount, expected }) => {
      expect(subtractBusinessDays(value, amount)).toBe(expected);
      expect(subtractBusinessDays(value, amount, satSunNoHolidays)).toBe(
        expected,
      );
    },
  );

  // A walk of 10,000 business days is 2,000 whole weeks, so it lands 14,000 calendar days
  // earlier — the exact inverse of the same forward walk in addBusinessDays.
  it.each`
    value           | amount   | expected
    ${"2062-05-01"} | ${10000} | ${"2024-01-01"}
    ${"2100-08-30"} | ${20000} | ${"2024-01-01"}
  `(
    "returns $expected for $value - $amount business days (long walk)",
    ({ value, amount, expected }) => {
      expect(subtractBusinessDays(value, amount)).toBe(expected);
    },
  );

  it.each(invalidCalendars.map((calendar) => ({ calendar })))(
    "returns an empty string for the invalid calendar $calendar",
    ({ calendar }) => {
      expect(subtractBusinessDays("2024-07-05", 1, calendar as never)).toBe("");
    },
  );

  it.each`
    value      | amount  | expected
    ${testDay} | ${1}    | ${"2024-02-28"}
    ${testDay} | ${10}   | ${"2024-02-15"}
    ${testDay} | ${0}    | ${"2024-02-29"}
    ${testDay} | ${5}    | ${"2024-02-22"}
    ${testDay} | ${20}   | ${"2024-02-01"}
    ${testDay} | ${50}   | ${"2023-12-21"}
    ${testDay} | ${-1}   | ${"2024-03-01"}
    ${testDay} | ${-5}   | ${"2024-03-07"}
    ${testDay} | ${-10}  | ${"2024-03-14"}
    ${testDay} | ${-100} | ${"2024-07-18"}
  `(
    "returns $expected for $value - $amount business days",
    ({ value, amount, expected }) => {
      expect(subtractBusinessDays(value, amount)).toBe(expected);
    },
  );

  it.each`
    nonStringInput
    ${"invalid-date"}
    ${"2024-02-30"}
    ${""}
    ${null}
    ${undefined}
    ${"2024-13-01"}
    ${"2024-00-01"}
    ${"not-a-date"}
    ${"2024/03/18"}
    ${"18-03-2024"}
  `(
    "returns an empty string for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(subtractBusinessDays(nonStringInput as never, 1)).toBe("");
    },
  );

  it.each`
    invalidAmount
    ${NaN}
    ${Infinity}
    ${-Infinity}
    ${null}
    ${undefined}
    ${"string"}
    ${"5"}
    ${{}}
    ${[]}
    ${true}
    ${false}
  `(
    "returns an empty string for invalid amount $invalidAmount",
    ({ invalidAmount }) => {
      expect(subtractBusinessDays("2024-03-18", invalidAmount as never)).toBe(
        "",
      );
    },
  );

  it("returns an empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(subtractBusinessDays("2024-03-18", 1)).toBe("");
  });

  it.each`
    amount
    ${1.5}
    ${-1.5}
    ${0.1}
  `(
    "returns an empty string for the fractional amount $amount",
    ({ amount }) => {
      expect(subtractBusinessDays("2024-07-03", amount)).toBe("");
      expect(subtractBusinessDays("2024-07-03", amount, usIndependence)).toBe(
        "",
      );
    },
  );

  // calendar.timeZone records locality; it never changes the walk for a local date.
  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "walks the same way whatever calendar.timeZone says ($timeZone)",
    ({ timeZone }) => {
      const calendar = { ...usIndependence, timeZone };

      expect(subtractBusinessDays("2024-07-05", 1, calendar)).toBe(
        "2024-07-03",
      );
      expect(subtractBusinessDays("2024-07-05", -1, calendar)).toBe(
        "2024-07-08",
      );
    },
  );

  // Temporal's ISO grammar reads an elective annotation (`[foo=bar]`) and `[u-ca=iso8601]` and ignores
  // them (RFC 9557 §3.3; native Temporal agrees), so the result is the unannotated input's.
  it.each`
    value                         | amount | expected
    ${"2024-03-18[foo=bar]"}      | ${0}   | ${"2024-03-18"}
    ${"2024-03-18[u-ca=iso8601]"} | ${1}   | ${"2024-03-15"}
    ${"2024-03-18[!foo=bar]"}     | ${1}   | ${""}
  `(
    "reads the annotations of $value as Temporal does (amount $amount) → $expected",
    ({ value, amount, expected }) => {
      expect(subtractBusinessDays(value, amount)).toBe(expected);
    },
  );
});
