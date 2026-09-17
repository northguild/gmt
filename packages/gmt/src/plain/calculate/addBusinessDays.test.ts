import { battleTestTimeZones } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { addBusinessDays } from "./addBusinessDays";

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

describe("addBusinessDays", () => {
  // Weekend and holidays are both skipped, forwards and backwards.
  it.each`
    value           | amount | expected        | description
    ${"2024-07-03"} | ${1}   | ${"2024-07-05"} | ${"Wed over the Thu holiday to Fri"}
    ${"2024-07-03"} | ${2}   | ${"2024-07-08"} | ${"Wed over holiday and weekend to Mon"}
    ${"2024-07-03"} | ${3}   | ${"2024-07-09"} | ${"Wed to Tue"}
    ${"2024-07-04"} | ${1}   | ${"2024-07-05"} | ${"from the holiday itself"}
    ${"2024-07-06"} | ${1}   | ${"2024-07-08"} | ${"from a Saturday"}
    ${"2024-07-05"} | ${-1}  | ${"2024-07-03"} | ${"Fri back over the holiday to Wed"}
    ${"2024-07-08"} | ${-2}  | ${"2024-07-03"} | ${"Mon back over weekend and holiday"}
    ${"2024-07-04"} | ${-1}  | ${"2024-07-03"} | ${"back from the holiday itself"}
  `(
    "returns $expected for $value + $amount business days — $description",
    ({ value, amount, expected }) => {
      expect(addBusinessDays(value, amount, usIndependence)).toBe(expected);
    },
  );

  // Identity at zero holds even when the date is not itself a working day.
  it.each`
    value           | calendar          | description
    ${"2024-07-03"} | ${usIndependence} | ${"a working day"}
    ${"2024-07-04"} | ${usIndependence} | ${"a holiday"}
    ${"2024-07-06"} | ${usIndependence} | ${"a Saturday"}
    ${"2024-07-05"} | ${fridaySaturday} | ${"a Friday, weekend there"}
  `(
    "returns $value unchanged for an amount of 0 when $value is $description",
    ({ value, calendar }) => {
      expect(addBusinessDays(value, 0, calendar)).toBe(value);
    },
  );

  // Weekends other than Saturday-Sunday.
  it.each`
    value           | amount | calendar           | expected        | description
    ${"2024-07-04"} | ${1}   | ${fridaySaturday}  | ${"2024-07-07"} | ${"Thu over Fri-Sat to Sun"}
    ${"2024-07-04"} | ${2}   | ${fridaySaturday}  | ${"2024-07-08"} | ${"Thu to Mon"}
    ${"2024-07-07"} | ${-1}  | ${fridaySaturday}  | ${"2024-07-04"} | ${"Sun back over Fri-Sat to Thu"}
    ${"2024-07-05"} | ${1}   | ${sundayOnly}      | ${"2024-07-06"} | ${"Sat is a working day"}
    ${"2024-07-06"} | ${1}   | ${sundayOnly}      | ${"2024-07-08"} | ${"only Sun closes"}
    ${"2024-07-03"} | ${1}   | ${noWeeklyClosure} | ${"2024-07-05"} | ${"holiday only, no weekend"}
    ${"2024-07-05"} | ${1}   | ${noWeeklyClosure} | ${"2024-07-06"} | ${"Sat works with no weekly closure"}
    ${"2024-07-03"} | ${1}   | ${bridgedHoliday}  | ${"2024-07-08"} | ${"two holidays bridging into the weekend"}
  `(
    "returns $expected for $value + $amount business days — $description",
    ({ value, amount, calendar, expected }) => {
      expect(addBusinessDays(value, amount, calendar)).toBe(expected);
    },
  );

  // Omitting the calendar and spelling out the old default must agree.
  it.each`
    value           | amount | expected
    ${"2024-03-15"} | ${1}   | ${"2024-03-18"}
    ${"2024-03-15"} | ${-1}  | ${"2024-03-14"}
    ${"2024-02-29"} | ${50}  | ${"2024-05-09"}
  `(
    "treats an absent calendar and an explicit Sat-Sun calendar alike for $value + $amount",
    ({ value, amount, expected }) => {
      expect(addBusinessDays(value, amount)).toBe(expected);
      expect(addBusinessDays(value, amount, satSunNoHolidays)).toBe(expected);
    },
  );

  // A holiday list that the walk never touches changes nothing.
  it("ignores holidays that fall outside the walk", () => {
    expect(
      addBusinessDays("2024-07-08", 1, {
        weekend: [6, 7],
        holidays: ["2024-12-25"],
        timeZone: "UTC",
      }),
    ).toBe("2024-07-09");
  });

  it.each(invalidCalendars.map((calendar) => ({ calendar })))(
    "returns an empty string for the invalid calendar $calendar",
    ({ calendar }) => {
      expect(addBusinessDays("2024-07-03", 1, calendar as never)).toBe("");
    },
  );

  it.each`
    value      | amount | expected
    ${testDay} | ${1}   | ${"2024-03-01"}
    ${testDay} | ${2}   | ${"2024-03-04"}
    ${testDay} | ${5}   | ${"2024-03-07"}
    ${testDay} | ${20}  | ${"2024-03-28"}
    ${testDay} | ${50}  | ${"2024-05-09"}
    ${testDay} | ${-1}  | ${"2024-02-28"}
    ${testDay} | ${-2}  | ${"2024-02-27"}
    ${testDay} | ${-5}  | ${"2024-02-22"}
    ${testDay} | ${-10} | ${"2024-02-15"}
    ${testDay} | ${0}   | ${"2024-02-29"}
  `(
    "returns $expected for $value + $amount business days",
    ({ value, amount, expected }) => {
      expect(addBusinessDays(value, amount)).toBe(expected);
    },
  );

  // A walk of 10,000 business days is 2,000 whole weeks from a Monday, so it lands 14,000
  // calendar days later — on a Monday again. Recursion used to blow the stack near ~6,000 and
  // return the invalid-input sentinel for a perfectly valid request.
  it.each`
    value           | amount   | expected
    ${"2024-01-01"} | ${5000}  | ${"2043-03-02"}
    ${"2024-01-01"} | ${10000} | ${"2062-05-01"}
    ${"2024-01-01"} | ${20000} | ${"2100-08-30"}
  `(
    "returns $expected for $value + $amount business days (long walk)",
    ({ value, amount, expected }) => {
      expect(addBusinessDays(value, amount)).toBe(expected);
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
    ${"2024/03/15"}
    ${"15-03-2024"}
  `(
    "returns an empty string for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(addBusinessDays(nonStringInput as never, 1)).toBe("");
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
      expect(addBusinessDays("2024-03-15", invalidAmount as never)).toBe("");
    },
  );

  it("returns an empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(addBusinessDays("2024-03-15", 1)).toBe("");
  });

  it.each`
    amount
    ${1.5}
    ${-1.5}
    ${0.1}
  `(
    "returns an empty string for the fractional amount $amount",
    ({ amount }) => {
      expect(addBusinessDays("2024-07-03", amount)).toBe("");
      expect(addBusinessDays("2024-07-03", amount, usIndependence)).toBe("");
    },
  );

  // calendar.timeZone records locality; it never changes the walk for a local date.
  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "walks the same way whatever calendar.timeZone says ($timeZone)",
    ({ timeZone }) => {
      const calendar = { ...usIndependence, timeZone };

      expect(addBusinessDays("2024-07-03", 1, calendar)).toBe("2024-07-05");
      expect(addBusinessDays("2024-07-03", -1, calendar)).toBe("2024-07-02");
    },
  );

  // The bounded walk gives up rather than returning a partial answer: 2024-01-01 plus
  // 142,858 Mon-Fri days is 2571-08-01, exactly 200,000 calendar days on. One more is over.
  it("returns an empty string once the walk exceeds the 200,000-day cap", () => {
    expect(addBusinessDays("2024-01-01", 142_858)).toBe("2571-08-01");
    expect(addBusinessDays("2024-01-01", 142_859)).toBe("");
  });

  // Temporal's ISO grammar reads an elective annotation (`[foo=bar]`) and `[u-ca=iso8601]` and ignores
  // them (RFC 9557 §3.3; native Temporal agrees), so the result is the unannotated input's.
  it.each`
    value                         | amount | expected
    ${"2024-03-15[foo=bar]"}      | ${0}   | ${"2024-03-15"}
    ${"2024-03-15[u-ca=iso8601]"} | ${1}   | ${"2024-03-18"}
    ${"2024-03-15[!foo=bar]"}     | ${1}   | ${""}
  `(
    "reads the annotations of $value as Temporal does (amount $amount) → $expected",
    ({ value, amount, expected }) => {
      expect(addBusinessDays(value, amount)).toBe(expected);
    },
  );
});
