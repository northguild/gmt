import { isBeforeDate } from "./isBeforeDate";

describe("isBeforeDate", () => {
  it.each`
    value1          | value2          | expected
    ${"2024-02-01"} | ${"2024-02-29"} | ${true}
    ${"2024-02-28"} | ${"2024-02-29"} | ${true}
    ${"2024-03-01"} | ${"2024-02-29"} | ${false}
    ${"2024-02-29"} | ${"2024-02-29"} | ${false}
    ${"invalid"}    | ${"2024-02-29"} | ${false}
  `(
    "returns $expected when checking if $value1 is before $value2",
    ({
      value1,
      value2,
      expected,
    }: {
      value1: string;
      value2: string;
      expected: boolean;
    }) => {
      expect(isBeforeDate(value1, value2)).toBe(expected);
    },
  );
});
