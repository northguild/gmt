import { isValidDateRange } from "./isValidDateRange";

describe("isValidDateRange", () => {
  it.each`
    value1            | value2          | allowEqual | expected
    ${"2024-01-01"}   | ${"2024-01-01"} | ${false}   | ${false}
    ${"2024-01-01"}   | ${"2024-01-01"} | ${true}    | ${true}
    ${"2024-01-01"}   | ${"2024-01-02"} | ${false}   | ${true}
    ${"2024-12-31"}   | ${"2024-01-01"} | ${false}   | ${false}
    ${"invalid-date"} | ${"2024-12-31"} | ${false}   | ${false}
  `(
    "validates date range: $value1 to $value2 with allowEqual=$allowEqual as $expected",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidDateRange({ value1, value2, options: { allowEqual } }),
      ).toEqual(expected);
    },
  );
});
