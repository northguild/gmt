import { isBeforeDateTime } from "./isBeforeDateTime";

describe("isBeforeDateTime", () => {
  it.each`
    value1                | value2                | expected
    ${"2024-02-29T09:59"} | ${"2024-02-29T10:00"} | ${true}
    ${"2024-02-29T10:00"} | ${"2024-02-29T10:00"} | ${false}
    ${"2024-02-29T10:01"} | ${"2024-02-29T10:00"} | ${false}
    ${"invalid-datetime"} | ${"2024-02-29T10:00"} | ${false}
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
      expect(isBeforeDateTime(value1, value2)).toBe(expected);
    },
  );
});
