import { calendarDateFromMonthCode } from "./calendarDateFromMonthCode";

// Expected dates are the astronomical or arithmetic calendar events (1 Shawwal = Eid al-Fitr,
// 15 Nisan = first day of Passover, Nowruz, the 6th of Pagume in an Ethiopian leap year), checked
// against the polyfill with overflow "reject", never against the function.
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
  `(
    "$calendar $year $monthCode day $day is $expected",
    ({ calendar, year, monthCode, day, expected }) => {
      expect(
        calendarDateFromMonthCode(calendar, year, monthCode, day)?.toString(),
      ).toBe(expected);
    },
  );

  it.each`
    calendar              | year      | monthCode | day   | why
    ${"hebrew"}           | ${5785}   | ${"M05L"} | ${1}  | ${"common Hebrew year has no leap month"}
    ${"hebrew"}           | ${5786}   | ${"M05L"} | ${1}  | ${"common Hebrew year has no leap month"}
    ${"islamic-umalqura"} | ${1447}   | ${"M12"}  | ${30} | ${"month 12 of 1447 has 29 days"}
    ${"ethioaa"}          | ${7518}   | ${"M13"}  | ${6}  | ${"Pagume has 5 days in a common year"}
    ${"iso8601"}          | ${2026}   | ${"M02"}  | ${29} | ${"February 2026 has 28 days"}
    ${"iso8601"}          | ${2026}   | ${"M13"}  | ${1}  | ${"iso8601 has no month 13"}
    ${"iso8601"}          | ${275760} | ${"M09"}  | ${14} | ${"September +275760 ends at the limit, on the 13th"}
    ${"iso8601"}          | ${275760} | ${"M09"}  | ${31} | ${"no 31 September"}
    ${"hebrew"}           | ${5786}   | ${"M02"}  | ${30} | ${"Heshvan has 29 days in a regular year"}
    ${"hebrew"}           | ${5784}   | ${"M06"}  | ${30} | ${"Adar II has 29 days"}
    ${"persian"}          | ${1404}   | ${"M12"}  | ${30} | ${"Esfand has 29 days outside a leap year"}
    ${"persian"}          | ${1404}   | ${"M07"}  | ${31} | ${"month 7 has 30 days"}
    ${"indian"}           | ${1947}   | ${"M01"}  | ${31} | ${"Chaitra has 30 days outside a leap year"}
    ${"islamic-civil"}    | ${1448}   | ${"M12"}  | ${30} | ${"1448 is not a leap year"}
  `(
    "$calendar $year $monthCode day $day is null: $why",
    ({ calendar, year, monthCode, day }) => {
      expect(calendarDateFromMonthCode(calendar, year, monthCode, day)).toBe(
        null,
      );
    },
  );

  it("throws a RangeError for a date outside Temporal's range", () => {
    expect(() =>
      calendarDateFromMonthCode("iso8601", 300000, "M01", 1),
    ).toThrow(RangeError);
  });
});
