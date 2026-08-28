import { dateCycleFieldBounds } from "./dateCycleFieldBounds";

describe("dateCycleFieldBounds", () => {
  it("returns null for year (unbounded)", () => {
    expect(
      dateCycleFieldBounds("year", { monthsInYear: 12, daysInMonth: 31 }),
    ).toBeNull();
  });

  it.each`
    monthsInYear | daysInMonth | expected
    ${12}        | ${31}       | ${{ min: 1, max: 12 }}
  `(
    "returns { min: 1, max: monthsInYear } for month",
    ({ monthsInYear, daysInMonth, expected }) => {
      expect(
        dateCycleFieldBounds("month", { monthsInYear, daysInMonth }),
      ).toEqual(expected);
    },
  );

  it.each`
    daysInMonth | expected
    ${31}       | ${{ min: 1, max: 31 }}
    ${30}       | ${{ min: 1, max: 30 }}
    ${29}       | ${{ min: 1, max: 29 }}
    ${28}       | ${{ min: 1, max: 28 }}
  `(
    "returns { min: 1, max: daysInMonth } for day when daysInMonth is $daysInMonth",
    ({ daysInMonth, expected }) => {
      expect(
        dateCycleFieldBounds("day", { monthsInYear: 12, daysInMonth }),
      ).toEqual(expected);
    },
  );
});
