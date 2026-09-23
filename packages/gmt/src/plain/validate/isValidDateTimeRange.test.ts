import { isValidDateTimeRange } from "./isValidDateTimeRange";

describe("isValidDateTimeRange", () => {
  it.each`
    value1                   | value2                   | allowEqual | expected
    ${"2024-01-01T00:00:00"} | ${"2024-12-31T23:59:59"} | ${false}   | ${true}
    ${"2024-01-01T00:00:00"} | ${"2024-02-29T12:00:00"} | ${false}   | ${true}
    ${"2000-01-01T00:00:00"} | ${"2024-12-31T23:59:59"} | ${false}   | ${true}
  `(
    "returns $expected for valid datetime range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidDateTimeRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1                   | value2                       | allowEqual | expected
    ${"2024-01-01T00:00:00"} | ${"2024-01-01T00:00:00"}     | ${false}   | ${false}
    ${"2024-01-01T00:00:00"} | ${"2024-01-01T00:00:00"}     | ${true}    | ${true}
    ${"2024-01-01T00:00:00"} | ${"2024-01-01T00:00:00.000"} | ${true}    | ${true}
  `(
    "returns $expected for equal datetimes $value1 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidDateTimeRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1                   | value2                   | allowEqual | expected
    ${"2024-12-31T23:59:59"} | ${"2024-01-01T00:00:00"} | ${false}   | ${false}
    ${"2024-02-29T12:00:00"} | ${"2024-01-01T00:00:00"} | ${false}   | ${false}
  `(
    "returns $expected for reversed datetime range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidDateTimeRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1                   | value2
    ${"invalid"}             | ${"2024-01-01T00:00:00"}
    ${""}                    | ${"2024-01-01T00:00:00"}
    ${"2024-13-01T10:00:00"} | ${"2024-01-01T00:00:00"}
    ${"2024-01-01T00:00:00"} | ${"invalid"}
    ${"2024-01-01T00:00:00"} | ${""}
    ${"2024-01-01T00:00:00"} | ${"2024-13-01T10:00:00"}
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
    ${"2024-01-01T00:00:00"} | ${"2024-12-31T23:59:60"} | ${false}
  `(
    "returns $expected for leap-second input: $value1 vs $value2",
    ({ value1, value2, expected }) => {
      expect(isValidDateTimeRange({ value1, value2 })).toBe(expected);
    },
  );

  it.each`
    value1                   | value2
    ${null}                  | ${"2024-01-01T00:00:00"}
    ${undefined}             | ${"2024-01-01T00:00:00"}
    ${123}                   | ${"2024-01-01T00:00:00"}
    ${true}                  | ${"2024-01-01T00:00:00"}
    ${[]}                    | ${"2024-01-01T00:00:00"}
    ${{}}                    | ${"2024-01-01T00:00:00"}
    ${"2024-01-01T00:00:00"} | ${null}
    ${"2024-01-01T00:00:00"} | ${undefined}
    ${"2024-01-01T00:00:00"} | ${123}
    ${"2024-01-01T00:00:00"} | ${true}
    ${"2024-01-01T00:00:00"} | ${[]}
    ${"2024-01-01T00:00:00"} | ${{}}
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

  // Each endpoint is read as the single-value validator reads it (RFC 9557 §3.3, Temporal
  // `ParseISODateTime`): elective and `[u-ca=iso8601]` annotations are ignored, an unknown critical
  // one is rejected. Native Temporal agrees.
  it.each`
    value1                             | value2                              | expected
    ${"2024-03-10T12:00[foo=bar]"}     | ${"2024-03-10T13:00[u-ca=iso8601]"} | ${true}
    ${"2024-03-10T12:00[Asia/Tokyo]"}  | ${"2024-03-10T13:00"}               | ${true}
    ${"2024-03-10T12:00[!foo=bar]"}    | ${"2024-03-10T13:00"}               | ${false}
    ${"2024-03-10T12:00[u-ca=hebrew]"} | ${"2024-03-10T13:00"}               | ${false}
    ${"2016-12-31T23:59:60[foo=bar]"}  | ${"2017-01-01T00:00"}               | ${false}
  `(
    "reads the annotations of $value1 and $value2 → $expected",
    ({ value1, value2, expected }) => {
      expect(isValidDateTimeRange({ value1, value2 })).toBe(expected);
    },
  );
});
