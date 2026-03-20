import { isBeforeTime } from "./isBeforeTime";

describe("isBeforeTime", () => {
  it.each`
    value1     | value2     | expected
    ${"11:58"} | ${"11:59"} | ${true}
    ${"11:59"} | ${"11:59"} | ${false}
    ${"12:00"} | ${"11:59"} | ${false}
    ${"bad"}   | ${"11:59"} | ${false}
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
      expect(isBeforeTime(value1, value2)).toBe(expected);
    },
  );
});
