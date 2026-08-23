import { isAfterDate } from "./isAfterDate";

describe("isAfterDate", () => {
  it("returns false when comparing a date to itself", () => {
    expect(isAfterDate("2024-01-01", "2024-01-01")).toBe(false);
  });

  it.each`
    value1          | value2          | expected
    ${"2024-02-28"} | ${"2024-02-29"} | ${false}
    ${"2024-02-29"} | ${"2024-02-29"} | ${false}
    ${"2024-03-01"} | ${"2024-02-29"} | ${true}
    ${"invalid"}    | ${"2024-02-29"} | ${false}
  `(
    "returns $expected when checking if $value1 is after $value2",
    ({
      value1,
      value2,
      expected,
    }: {
      value1: string;
      value2: string;
      expected: boolean;
    }) => {
      expect(isAfterDate(value1, value2)).toBe(expected);
    },
  );
});
