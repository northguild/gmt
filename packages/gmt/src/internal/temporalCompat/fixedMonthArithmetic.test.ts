import { addFixedMonths, fixedMonthsBetween } from "./fixedMonthArithmetic";

// Pure integer arithmetic, so the expected values follow from the month count alone: the Intl
// era/monthCode proposal's BalanceNonISODate for a calendar with the same months in every year
// (12 for the Islamic calendars, 13 for coptic and ethiopic). No engine is consulted.
describe("addFixedMonths", () => {
  it.each`
    year       | month | months  | monthsPerYear | expected
    ${1}       | ${5}  | ${0}    | ${12}         | ${{ year: 1, month: 5 }}
    ${1}       | ${5}  | ${1}    | ${12}         | ${{ year: 1, month: 6 }}
    ${1}       | ${5}  | ${8}    | ${12}         | ${{ year: 2, month: 1 }}
    ${1}       | ${5}  | ${-5}   | ${12}         | ${{ year: 0, month: 12 }}
    ${-1}      | ${5}  | ${24}   | ${12}         | ${{ year: 1, month: 5 }}
    ${0}       | ${12} | ${1}    | ${12}         | ${{ year: 1, month: 1 }}
    ${1}       | ${1}  | ${-1}   | ${12}         | ${{ year: 0, month: 12 }}
    ${-126}    | ${9}  | ${3000} | ${12}         | ${{ year: 124, month: 9 }}
    ${-126}    | ${9}  | ${-12}  | ${12}         | ${{ year: -127, month: 9 }}
    ${2000}    | ${13} | ${1}    | ${13}         | ${{ year: 2001, month: 1 }}
    ${2000}    | ${1}  | ${-1}   | ${13}         | ${{ year: 1999, month: 13 }}
    ${-280804} | ${3}  | ${9}    | ${12}         | ${{ year: -280804, month: 12 }}
    ${-280804} | ${3}  | ${10}   | ${12}         | ${{ year: -280803, month: 1 }}
  `(
    "$year-$month + $months months at $monthsPerYear per year is $expected",
    ({ year, month, months, monthsPerYear, expected }) => {
      expect(addFixedMonths({ year, month }, months, monthsPerYear)).toEqual(
        expected,
      );
    },
  );

  it("accepts a month ordinal past the year's count, as BalanceNonISODate does", () => {
    expect(addFixedMonths({ year: 1, month: 14 }, 0, 12)).toEqual({
      year: 2,
      month: 2,
    });
    expect(addFixedMonths({ year: 1, month: 25 }, -1, 12)).toEqual({
      year: 2,
      month: 12,
    });
  });
});

describe("fixedMonthsBetween", () => {
  it.each`
    from                         | to                          | monthsPerYear | expected
    ${{ year: 1, month: 5 }}     | ${{ year: 1, month: 5 }}    | ${12}         | ${0}
    ${{ year: 1, month: 5 }}     | ${{ year: 2, month: 1 }}    | ${12}         | ${8}
    ${{ year: 2, month: 1 }}     | ${{ year: 1, month: 5 }}    | ${12}         | ${-8}
    ${{ year: -1, month: 5 }}    | ${{ year: 1, month: 5 }}    | ${12}         | ${24}
    ${{ year: 0, month: 12 }}    | ${{ year: 1, month: 1 }}    | ${12}         | ${1}
    ${{ year: -126, month: 9 }}  | ${{ year: 124, month: 9 }}  | ${12}         | ${3000}
    ${{ year: 1999, month: 13 }} | ${{ year: 2000, month: 1 }} | ${13}         | ${1}
  `(
    "$from to $to at $monthsPerYear per year is $expected",
    ({ from, to, monthsPerYear, expected }) => {
      expect(fixedMonthsBetween(from, to, monthsPerYear)).toBe(expected);
    },
  );

  it("inverts addFixedMonths", () => {
    const start = { year: -3, month: 7 };
    for (const months of [-40, -13, -1, 0, 1, 11, 12, 13, 50]) {
      expect(
        fixedMonthsBetween(start, addFixedMonths(start, months, 12), 12),
      ).toBe(months);
    }
  });
});
