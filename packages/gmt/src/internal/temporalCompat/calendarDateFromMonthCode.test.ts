import {
  calendarDateFromMonthCode,
  longestDayOfMonthCode,
} from "./calendarDateFromMonthCode";

// Expected dates are the astronomical or arithmetic calendar events (1 Shawwal = Eid al-Fitr,
// 15 Nisan = first day of Passover, Nowruz, the 6th of Pagume in an Ethiopian leap year), checked
// against the polyfill with overflow "reject", never against the function. The polyfill misreads
// several calendars at Temporal's range limits, so the rows in the years those limits cut come
// from Reingold & Dershowitz's arithmetic (Islamic civil, Hebrew) and ICU's 33-year Persian rule.
describe("calendarDateFromMonthCode", () => {
  it.each`
    calendar              | year       | monthCode | day   | expected
    ${"islamic-umalqura"} | ${1447}    | ${"M10"}  | ${1}  | ${"2026-03-20"}
    ${"islamic-civil"}    | ${1420}    | ${"M10"}  | ${1}  | ${"2000-01-08"}
    ${"islamic-civil"}    | ${1421}    | ${"M10"}  | ${1}  | ${"2000-12-28"}
    ${"hebrew"}           | ${5786}    | ${"M07"}  | ${15} | ${"2026-04-02"}
    ${"hebrew"}           | ${5784}    | ${"M05L"} | ${1}  | ${"2024-02-10"}
    ${"persian"}          | ${1405}    | ${"M01"}  | ${1}  | ${"2026-03-21"}
    ${"ethioaa"}          | ${7519}    | ${"M13"}  | ${6}  | ${"2027-09-11"}
    ${"ethioaa"}          | ${7518}    | ${"M13"}  | ${5}  | ${"2026-09-10"}
    ${"iso8601"}          | ${2024}    | ${"M02"}  | ${29} | ${"2024-02-29"}
    ${"iso8601"}          | ${-271821} | ${"M04"}  | ${19} | ${"-271821-04-19"}
    ${"iso8601"}          | ${275760}  | ${"M08"}  | ${31} | ${"+275760-08-31"}
    ${"iso8601"}          | ${275760}  | ${"M09"}  | ${13} | ${"+275760-09-13"}
    ${"gregory"}          | ${275760}  | ${"M09"}  | ${1}  | ${"+275760-09-01"}
    ${"hebrew"}           | ${5785}    | ${"M02"}  | ${30} | ${"2024-12-01"}
    ${"hebrew"}           | ${5784}    | ${"M05L"} | ${30} | ${"2024-03-10"}
    ${"hebrew"}           | ${5786}    | ${"M01"}  | ${1}  | ${"2025-09-23"}
    ${"islamic-tbla"}     | ${1447}    | ${"M10"}  | ${1}  | ${"2026-03-19"}
    ${"islamic-civil"}    | ${1447}    | ${"M12"}  | ${30} | ${"2026-06-16"}
    ${"persian"}          | ${1403}    | ${"M12"}  | ${30} | ${"2025-03-20"}
    ${"indian"}           | ${1946}    | ${"M01"}  | ${31} | ${"2024-04-20"}
    ${"indian"}           | ${1947}    | ${"M01"}  | ${1}  | ${"2025-03-22"}
    ${"ethioaa"}          | ${7515}    | ${"M01"}  | ${1}  | ${"2022-09-11"}
    ${"islamic-civil"}    | ${-280803} | ${"M01"}  | ${1}  | ${"-271820-01-20"}
    ${"islamic-civil"}    | ${-280804} | ${"M04"}  | ${1}  | ${"-271821-04-29"}
    ${"persian"}          | ${-272442} | ${"M01"}  | ${9}  | ${"-271821-04-19"}
    ${"persian"}          | ${-272442} | ${"M02"}  | ${1}  | ${"-271821-05-12"}
    ${"hebrew"}           | ${279517}  | ${"M09"}  | ${1}  | ${"+275760-09-03"}
    ${"hebrew"}           | ${279517}  | ${"M09"}  | ${11} | ${"+275760-09-13"}
  `(
    "$calendar $year $monthCode day $day is $expected",
    ({ calendar, year, monthCode, day, expected }) => {
      expect(
        calendarDateFromMonthCode(calendar, year, monthCode, day)?.toString(),
      ).toBe(expected);
    },
  );

  it.each`
    calendar              | year       | monthCode | day   | why
    ${"hebrew"}           | ${5785}    | ${"M05L"} | ${1}  | ${"common Hebrew year has no leap month"}
    ${"hebrew"}           | ${5786}    | ${"M05L"} | ${1}  | ${"common Hebrew year has no leap month"}
    ${"islamic-umalqura"} | ${1447}    | ${"M12"}  | ${30} | ${"month 12 of 1447 has 29 days"}
    ${"ethioaa"}          | ${7518}    | ${"M13"}  | ${6}  | ${"Pagume has 5 days in a common year"}
    ${"iso8601"}          | ${2026}    | ${"M02"}  | ${29} | ${"February 2026 has 28 days"}
    ${"iso8601"}          | ${2026}    | ${"M13"}  | ${1}  | ${"iso8601 has no month 13"}
    ${"iso8601"}          | ${275760}  | ${"M09"}  | ${14} | ${"September +275760 ends at the limit, on the 13th"}
    ${"iso8601"}          | ${275760}  | ${"M09"}  | ${31} | ${"no 31 September"}
    ${"hebrew"}           | ${5786}    | ${"M02"}  | ${30} | ${"Heshvan has 29 days in a regular year"}
    ${"hebrew"}           | ${5784}    | ${"M06"}  | ${30} | ${"Adar II has 29 days"}
    ${"persian"}          | ${1404}    | ${"M12"}  | ${30} | ${"Esfand has 29 days outside a leap year"}
    ${"persian"}          | ${1404}    | ${"M07"}  | ${31} | ${"month 7 has 30 days"}
    ${"indian"}           | ${1947}    | ${"M01"}  | ${31} | ${"Chaitra has 30 days outside a leap year"}
    ${"islamic-civil"}    | ${1448}    | ${"M12"}  | ${30} | ${"1448 is not a leap year"}
    ${"islamic-civil"}    | ${-280804} | ${"M01"}  | ${1}  | ${"-271821-01-30, before the first date of its year"}
    ${"persian"}          | ${-272442} | ${"M01"}  | ${8}  | ${"-271821-04-18, the day before the first date"}
    ${"hebrew"}           | ${279517}  | ${"M09"}  | ${12} | ${"+275760-09-14, the day after the last date"}
    ${"hebrew"}           | ${279517}  | ${"M09"}  | ${15} | ${"+275760-09-17, after the last date of its year"}
  `(
    "$calendar $year $monthCode day $day is null: $why",
    ({ calendar, year, monthCode, day }) => {
      expect(calendarDateFromMonthCode(calendar, year, monthCode, day)).toBe(
        null,
      );
    },
  );

  it.each`
    calendar           | year       | monthCode | day   | why
    ${"iso8601"}       | ${300000}  | ${"M01"}  | ${1}  | ${"the year is past the last date"}
    ${"hebrew"}        | ${279518}  | ${"M01"}  | ${1}  | ${"the year begins +275760-12-30, after the last date"}
    ${"islamic-civil"} | ${-280805} | ${"M12"}  | ${29} | ${"the year ends -271821-01-29, before the first date"}
    ${"persian"}       | ${-272443} | ${"M01"}  | ${1}  | ${"the year ends -271821-04-10, before the first date"}
  `(
    "$calendar $year $monthCode day $day throws a RangeError: $why",
    ({ calendar, year, monthCode, day }) => {
      expect(() =>
        calendarDateFromMonthCode(calendar, year, monthCode, day),
      ).toThrow(RangeError);
    },
  );
});

const TWELVE = [
  "M01",
  "M02",
  "M03",
  "M04",
  "M05",
  "M06",
  "M07",
  "M08",
  "M09",
  "M10",
  "M11",
  "M12",
];
const HEBREW = [...TWELVE.slice(0, 5), "M05L", ...TWELVE.slice(5)];

// Expected lengths are the calendar definitions (Reingold & Dershowitz, Calendrical Calculations),
// never the function: a Hebrew complete year's 30-day Heshvan and Kislev, Islamic civil month 12 of
// 30 days in a leap year, any Umm al-Qura month of 30, a Persian or Indian leap year's Esfand or
// Chaitra, and Pagume of 6 days in an Ethiopian leap year.
describe("longestDayOfMonthCode", () => {
  it.each`
    calendar              | monthCodes            | expected
    ${"iso8601"}          | ${TWELVE}             | ${[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]}
    ${"gregory"}          | ${TWELVE}             | ${[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]}
    ${"japanese"}         | ${TWELVE}             | ${[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]}
    ${"buddhist"}         | ${TWELVE}             | ${[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]}
    ${"roc"}              | ${TWELVE}             | ${[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]}
    ${"hebrew"}           | ${HEBREW}             | ${[30, 30, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29]}
    ${"islamic-civil"}    | ${TWELVE}             | ${[30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30]}
    ${"islamic-tbla"}     | ${TWELVE}             | ${[30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30]}
    ${"islamic-umalqura"} | ${TWELVE}             | ${[30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]}
    ${"persian"}          | ${TWELVE}             | ${[31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30]}
    ${"indian"}           | ${TWELVE}             | ${[31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30]}
    ${"ethioaa"}          | ${[...TWELVE, "M13"]} | ${[30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 6]}
  `(
    "$calendar months are at most $expected days",
    ({ calendar, monthCodes, expected }) => {
      expect(
        monthCodes.map((monthCode: string) =>
          longestDayOfMonthCode(calendar, monthCode),
        ),
      ).toEqual(expected);
    },
  );

  it.each`
    calendar           | monthCode | why
    ${"iso8601"}       | ${"M13"}  | ${"iso8601 has 12 months"}
    ${"gregory"}       | ${"M05L"} | ${"only Hebrew has a leap month code"}
    ${"islamic-civil"} | ${"M13"}  | ${"an Islamic year has 12 months"}
    ${"hebrew"}        | ${"M13"}  | ${"a Hebrew leap year adds M05L, not M13"}
  `("$calendar $monthCode is 0: $why", ({ calendar, monthCode }) => {
    expect(longestDayOfMonthCode(calendar, monthCode)).toBe(0);
  });
});
