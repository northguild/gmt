import { subtractDate } from "./subtractDate";

describe("subtractDate", () => {
  it.each`
    value           | amount | unit       | expected
    ${"2024-02-29"} | ${1}   | ${"day"}   | ${"2024-02-28"}
    ${"2024-02-29"} | ${2}   | ${"week"}  | ${"2024-02-15"}
    ${"2024-03-31"} | ${1}   | ${"month"} | ${"2024-02-29"}
    ${"2024-02-29"} | ${1}   | ${"year"}  | ${"2023-02-28"}
  `(
    "returns $expected for $value - $amount $unit",
    ({
      value,
      amount,
      unit,
      expected,
    }: {
      value: string;
      amount: number;
      unit: "year" | "month" | "week" | "day";
      expected: string;
    }) => {
      expect(subtractDate(value, amount, unit)).toBe(expected);
    },
  );

  it.each`
    negativeAmount | expectedDate
    ${-1}          | ${"2024-03-01"}
    ${-2}          | ${"2024-03-02"}
    ${-10}         | ${"2024-03-10"}
  `(
    "returns the correct date when subtracting a negative amount: $negativeAmount",
    ({ negativeAmount, expectedDate }) => {
      expect(subtractDate("2024-02-29", negativeAmount, "day")).toEqual(
        expectedDate,
      );
    },
  );

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
      expect(subtractDate("2024-02-29", invalidAmount as never, "day")).toEqual(
        "",
      );
    },
  );

  it.each`
    invalidValue
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
  `("returns an empty string for an invalid date", ({ invalidValue }) => {
    expect(subtractDate(invalidValue, 1, "day")).toEqual("");
  });

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `("returns an empty string for an invalid unit", ({ invalidUnit }) => {
    expect(subtractDate("2024-02-29", 1, invalidUnit as never)).toEqual("");
  });
});
