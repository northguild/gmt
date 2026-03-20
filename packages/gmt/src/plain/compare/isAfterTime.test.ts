import { isAfterTime } from "./isAfterTime";

describe("isAfterTime", () => {
  it.each`
    value1     | value2     | expected
    ${"12:00"} | ${"11:59"} | ${true}
    ${"11:59"} | ${"11:59"} | ${false}
    ${"11:58"} | ${"11:59"} | ${false}
    ${"bad"}   | ${"11:59"} | ${false}
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
      expect(isAfterTime(value1, value2)).toBe(expected);
    },
  );
});
