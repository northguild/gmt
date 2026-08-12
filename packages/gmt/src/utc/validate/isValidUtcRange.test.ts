import { isValidUtcRange } from "./isValidUtcRange";

describe("isValidUtcRange", () => {
  it.each`
    value1                    | value2                    | allowEqual | expected
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${false}   | ${true}
    ${"2024-01-01T00:00:00Z"} | ${"2024-06-15T12:30:45Z"} | ${false}   | ${true}
    ${"2000-01-01T00:00:00Z"} | ${"2024-12-31T23:59:59Z"} | ${false}   | ${true}
  `(
    "returns $expected for valid UTC range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(isValidUtcRange({ value1, value2, options: { allowEqual } })).toBe(
        expected,
      );
    },
  );

  it.each`
    value1                    | value2                    | allowEqual | expected
    ${"2024-01-01T10:00:00Z"} | ${"2024-01-01T10:00:00Z"} | ${false}   | ${false}
    ${"2024-01-01T10:00:00Z"} | ${"2024-01-01T10:00:00Z"} | ${true}    | ${true}
  `(
    "returns $expected for equal UTC instants $value1 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(isValidUtcRange({ value1, value2, options: { allowEqual } })).toBe(
        expected,
      );
    },
  );

  it.each`
    value1                    | value2                    | allowEqual | expected
    ${"2024-12-31T23:59:59Z"} | ${"2024-01-01T10:00:00Z"} | ${false}   | ${false}
    ${"2024-06-15T12:30:45Z"} | ${"2024-01-01T00:00:00Z"} | ${false}   | ${false}
  `(
    "returns $expected for reversed UTC range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(isValidUtcRange({ value1, value2, options: { allowEqual } })).toBe(
        expected,
      );
    },
  );

  it.each`
    value1                    | value2
    ${"invalid"}              | ${"2024-01-01T10:00:00Z"}
    ${""}                     | ${"2024-01-01T10:00:00Z"}
    ${"2024-01-01T10:00:00"}  | ${"2024-01-01T10:00:00Z"}
    ${"2024-01-01T10:00:00Z"} | ${"invalid"}
    ${"2024-01-01T10:00:00Z"} | ${""}
    ${"2024-01-01T10:00:00Z"} | ${"2024-01-01T10:00:00"}
    ${"invalid"}              | ${"invalid"}
    ${""}                     | ${""}
  `(
    "returns false for malformed UTC: $value1, $value2",
    ({ value1, value2 }) => {
      expect(isValidUtcRange({ value1, value2 })).toBe(false);
    },
  );

  it.each`
    value1                    | value2                    | expected
    ${"2024-12-31T23:59:60Z"} | ${"2025-01-01T00:00:00Z"} | ${false}
    ${"2024-01-01T10:00:00Z"} | ${"2024-12-31T23:59:60Z"} | ${false}
  `(
    "returns $expected for leap-second input: $value1 vs $value2",
    ({ value1, value2, expected }) => {
      expect(isValidUtcRange({ value1, value2 })).toBe(expected);
    },
  );

  it.each`
    value1                    | value2
    ${null}                   | ${"2024-01-01T10:00:00Z"}
    ${undefined}              | ${"2024-01-01T10:00:00Z"}
    ${123}                    | ${"2024-01-01T10:00:00Z"}
    ${true}                   | ${"2024-01-01T10:00:00Z"}
    ${[]}                     | ${"2024-01-01T10:00:00Z"}
    ${{}}                     | ${"2024-01-01T10:00:00Z"}
    ${"2024-01-01T10:00:00Z"} | ${null}
    ${"2024-01-01T10:00:00Z"} | ${undefined}
    ${"2024-01-01T10:00:00Z"} | ${123}
    ${"2024-01-01T10:00:00Z"} | ${true}
    ${"2024-01-01T10:00:00Z"} | ${[]}
    ${"2024-01-01T10:00:00Z"} | ${{}}
  `(
    "returns false for non-string input: $value1, $value2",
    ({ value1, value2 }) => {
      expect(
        isValidUtcRange({ value1: value1 as never, value2: value2 as never }),
      ).toBe(false);
    },
  );
});
