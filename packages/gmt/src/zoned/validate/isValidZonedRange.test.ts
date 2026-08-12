import { isValidZonedRange } from "./isValidZonedRange";

describe("isValidZonedRange", () => {
  it.each`
    value1                                           | value2                                           | allowEqual | expected
    ${"2024-01-01T10:00:00+00:00[UTC]"}              | ${"2024-12-31T23:59:59+00:00[UTC]"}              | ${false}   | ${true}
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-06-15T12:30:45-04:00[America/New_York]"} | ${false}   | ${true}
  `(
    "returns $expected for valid zoned range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidZonedRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1                                        | value2                                        | allowEqual | expected
    ${"2024-06-15T12:00:00+02:00[Europe/Berlin]"} | ${"2024-06-15T12:00:00+02:00[Europe/Berlin]"} | ${false}   | ${false}
    ${"2024-06-15T12:00:00+02:00[Europe/Berlin]"} | ${"2024-06-15T12:00:00+02:00[Europe/Berlin]"} | ${true}    | ${true}
  `(
    "returns $expected for equal zoned values $value1 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidZonedRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1                                           | value2                                           | allowEqual | expected
    ${"2024-12-31T23:59:59+00:00[UTC]"}              | ${"2024-01-01T10:00:00+00:00[UTC]"}              | ${false}   | ${false}
    ${"2024-06-15T12:30:45-04:00[America/New_York]"} | ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${false}   | ${false}
  `(
    "returns $expected for reversed zoned range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidZonedRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1                              | value2
    ${"invalid"}                        | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${""}                               | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${"not-a-zoned"}                    | ${"2024-06-15T12:00:00+00:00[UTC]"}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${"invalid"}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${""}
    ${"2024-06-15T12:00:00+00:00[UTC]"} | ${"not-a-zoned"}
    ${"invalid"}                        | ${"invalid"}
    ${""}                               | ${""}
  `(
    "returns false for malformed zoned: $value1, $value2",
    ({ value1, value2 }) => {
      expect(isValidZonedRange({ value1, value2 })).toBe(false);
    },
  );

  it.each`
    value1                              | value2                              | expected
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:60+00:00[UTC]"} | ${false}
  `(
    "returns $expected for leap-second input: $value1 vs $value2",
    ({ value1, value2, expected }) => {
      expect(isValidZonedRange({ value1, value2 })).toBe(expected);
    },
  );

  it.each`
    value1                              | value2
    ${null}                             | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${undefined}                        | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${123}                              | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${true}                             | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${[]}                               | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${{}}                               | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${null}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${undefined}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${123}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${true}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${[]}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${{}}
  `(
    "returns false for non-string input: $value1, $value2",
    ({ value1, value2 }) => {
      expect(
        isValidZonedRange({ value1: value1 as never, value2: value2 as never }),
      ).toBe(false);
    },
  );
});
