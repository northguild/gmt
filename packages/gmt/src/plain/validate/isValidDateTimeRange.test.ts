import { isValidDateTimeRange } from "./isValidDateTimeRange";

describe("isValidDateTimeRange", () => {
  it.each`
    value1                   | value2                   | allowEqual | expected
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:59"} | ${false}   | ${true}
    ${"2024-01-01T00:00:00"} | ${"2024-06-15T12:30:45"} | ${false}   | ${true}
    ${"2000-01-01T00:00:00"} | ${"2024-12-31T23:59:59"} | ${false}   | ${true}
  `(
    "returns $expected for valid datetime range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidDateTimeRange({ value1, value2, options: { allowEqual } }),
      ).toEqual(expected);
    },
  );

  it.each`
    value1                   | value2                       | allowEqual | expected
    ${"2024-01-01T10:00:00"} | ${"2024-01-01T10:00:00"}     | ${false}   | ${false}
    ${"2024-01-01T10:00:00"} | ${"2024-01-01T10:00:00"}     | ${true}    | ${true}
    ${"2024-01-01T10:00:00"} | ${"2024-01-01T10:00:00.000"} | ${true}    | ${true}
  `(
    "returns $expected for equal datetimes $value1 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidDateTimeRange({ value1, value2, options: { allowEqual } }),
      ).toEqual(expected);
    },
  );

  it.each`
    value1                   | value2                   | allowEqual | expected
    ${"2024-12-31T23:59:59"} | ${"2024-01-01T10:00:00"} | ${false}   | ${false}
    ${"2024-06-15T12:30:45"} | ${"2024-01-01T00:00:00"} | ${false}   | ${false}
  `(
    "returns $expected for reversed datetime range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidDateTimeRange({ value1, value2, options: { allowEqual } }),
      ).toEqual(expected);
    },
  );

  it.each`
    value1                   | value2
    ${"invalid"}             | ${"2024-01-01T10:00:00"}
    ${""}                    | ${"2024-01-01T10:00:00"}
    ${"2024-13-01T10:00:00"} | ${"2024-01-01T10:00:00"}
    ${"2024-01-01T10:00:00"} | ${"invalid"}
    ${"2024-01-01T10:00:00"} | ${""}
    ${"2024-01-01T10:00:00"} | ${"2024-13-01T10:00:00"}
    ${"invalid"}             | ${"invalid"}
    ${""}                    | ${""}
  `(
    "returns false for malformed datetime: $value1, $value2",
    ({ value1, value2 }) => {
      expect(isValidDateTimeRange({ value1, value2 })).toBe(false);
    },
  );

  it.each`
    value1                   | value2                   | expected
    ${"2024-12-31T23:59:60"} | ${"2025-01-01T00:00:00"} | ${false}
    ${"2024-01-01T10:00:00"} | ${"2024-12-31T23:59:60"} | ${false}
  `(
    "returns $expected for leap-second input: $value1 vs $value2",
    ({ value1, value2, expected }) => {
      expect(isValidDateTimeRange({ value1, value2 })).toBe(expected);
    },
  );

  it.each`
    value1                   | value2
    ${null}                  | ${"2024-01-01T10:00:00"}
    ${undefined}             | ${"2024-01-01T10:00:00"}
    ${123}                   | ${"2024-01-01T10:00:00"}
    ${true}                  | ${"2024-01-01T10:00:00"}
    ${[]}                    | ${"2024-01-01T10:00:00"}
    ${{}}                    | ${"2024-01-01T10:00:00"}
    ${"2024-01-01T10:00:00"} | ${null}
    ${"2024-01-01T10:00:00"} | ${undefined}
    ${"2024-01-01T10:00:00"} | ${123}
    ${"2024-01-01T10:00:00"} | ${true}
    ${"2024-01-01T10:00:00"} | ${[]}
    ${"2024-01-01T10:00:00"} | ${{}}
  `(
    "returns false for non-string input: $value1, $value2",
    ({ value1, value2 }) => {
      expect(
        isValidDateTimeRange({
          value1: value1 as never,
          value2: value2 as never,
        }),
      ).toBe(false);
    },
  );
});
