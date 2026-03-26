import { subtractDate } from "./subtractDate";

describe("subtractDate", () => {
  it.each`
    value           | units            | expected
    ${"2024-02-29"} | ${{ days: 1 }}   | ${"2024-02-28"}
    ${"2024-02-29"} | ${{ weeks: 1 }}  | ${"2024-02-22"}
    ${"2024-03-31"} | ${{ months: 1 }} | ${"2024-02-29"}
    ${"2024-02-29"} | ${{ years: 1 }}  | ${"2023-02-28"}
  `("returns $expected for $value - $units", ({ value, units, expected }) => {
    expect(subtractDate(value, units)).toBe(expected);
  });

  it.each`
    negativeAmount | expectedDate
    ${-1}          | ${"2024-03-01"}
    ${-2}          | ${"2024-03-02"}
    ${-10}         | ${"2024-03-10"}
  `(
    "returns the correct date when subtracting a negative amount: $negativeAmount",
    ({ negativeAmount, expectedDate }) => {
      expect(subtractDate("2024-02-29", { days: negativeAmount })).toEqual(
        expectedDate,
      );
    },
  );

  it.each`
    invalidDate
    ${"2024-02-30"}
    ${"not-a-date"}
    ${"2024-13-01"}
    ${"2024-00-10"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"12"}
    ${"2024"}
    ${"2024-02"}
    ${"2024-02-29T12:00:00"}
    ${"2024-02-29T12:00:00Z"}
  `(
    "returns an empty string for an invalid date $invalidDate",
    ({ invalidDate }) => {
      expect(subtractDate(invalidDate, { days: 1 })).toEqual("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `("returns an empty string for an invalid unit", ({ invalidUnit }) => {
    expect(subtractDate("2024-02-29", { [invalidUnit as never]: 1 })).toEqual(
      "",
    );
  });

  it.each`
    invalidAmount
    ${"not-a-number"}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
  `(
    "returns an empty string for an invalid amount: $invalidAmount",
    ({ invalidAmount }) => {
      expect(
        subtractDate("2024-02-29", { days: invalidAmount } as never),
      ).toEqual("");
    },
  );
});
