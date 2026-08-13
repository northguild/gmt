import { isValidDateRange } from "./isValidDateRange";

describe("isValidDateRange", () => {
  it.each`
    value1          | value2          | allowEqual | expected
    ${"2024-01-01"} | ${"2024-01-01"} | ${false}   | ${false}
    ${"2024-01-01"} | ${"2024-01-01"} | ${true}    | ${true}
    ${"2024-01-01"} | ${"2024-12-31"} | ${false}   | ${true}
    ${"2024-12-31"} | ${"2024-01-01"} | ${false}   | ${false}
  `(
    "validates date range: $value1 to $value2 with allowEqual=$allowEqual as $expected",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidDateRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1            | value2
    ${"invalid-date"} | ${"2024-12-31"}
    ${""}             | ${"2024-12-31"}
    ${"2024-12-31"}   | ${"invalid-date"}
    ${"2024-12-31"}   | ${""}
    ${"invalid-date"} | ${"invalid-date"}
    ${""}             | ${""}
  `(
    "returns false for malformed date: $value1, $value2",
    ({ value1, value2 }) => {
      expect(isValidDateRange({ value1, value2 })).toBe(false);
    },
  );

  it.each`
    value1          | value2
    ${null}         | ${"2024-12-31"}
    ${undefined}    | ${"2024-12-31"}
    ${123}          | ${"2024-12-31"}
    ${true}         | ${"2024-12-31"}
    ${[]}           | ${"2024-12-31"}
    ${{}}           | ${"2024-12-31"}
    ${"2024-12-31"} | ${null}
    ${"2024-12-31"} | ${undefined}
    ${"2024-12-31"} | ${123}
    ${"2024-12-31"} | ${true}
    ${"2024-12-31"} | ${[]}
    ${"2024-12-31"} | ${{}}
  `(
    "returns false for non-string input: $value1, $value2",
    ({ value1, value2 }) => {
      expect(
        isValidDateRange({
          value1: value1 as never,
          value2: value2 as never,
        }),
      ).toBe(false);
    },
  );
});
