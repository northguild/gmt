import { isBeforeUtc } from "./isBeforeUtc";

describe("isBeforeUtc", () => {
  it.each`
    value1                    | value2                    | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-02T00:00:00Z"} | ${true}
    ${"2024-01-02T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${false}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${false}
  `(
    "returns $expected when checking if $value1 is before $value2",
    ({ value1, value2, expected }) => {
      expect(isBeforeUtc(value1, value2)).toBe(expected);
    },
  );

  it.each`
    value1                    | value2
    ${"invalid"}              | ${"2024-01-02T00:00:00Z"}
    ${"2024-01-01T00:00:00Z"} | ${"invalid"}
    ${""}                     | ${"2024-01-02T00:00:00Z"}
    ${null}                   | ${"2024-01-02T00:00:00Z"}
  `(
    "returns false for invalid inputs: $value1 | $value2",
    ({ value1, value2 }) => {
      expect(isBeforeUtc(value1 as never, value2 as never)).toBe(false);
    },
  );
});
