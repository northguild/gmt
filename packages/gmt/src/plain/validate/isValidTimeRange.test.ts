import { isValidTimeRange } from "./isValidTimeRange";

describe("isValidTimeRange", () => {
  it.each`
    value1        | value2        | allowEqual | expected
    ${"09:00:00"} | ${"17:00:00"} | ${false}   | ${true}
    ${"00:00:00"} | ${"23:59:59"} | ${false}   | ${true}
    ${"12:00:00"} | ${"12:01:00"} | ${false}   | ${true}
  `(
    "returns $expected for valid time range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidTimeRange({ value1, value2, options: { allowEqual } }),
      ).toEqual(expected);
    },
  );

  it.each`
    value1        | value2        | allowEqual | expected
    ${"12:00:00"} | ${"12:00:00"} | ${false}   | ${false}
    ${"12:00:00"} | ${"12:00:00"} | ${true}    | ${true}
  `(
    "returns $expected for equal times $value1 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidTimeRange({ value1, value2, options: { allowEqual } }),
      ).toEqual(expected);
    },
  );

  it.each`
    value1        | value2        | allowEqual | expected
    ${"17:00:00"} | ${"09:00:00"} | ${false}   | ${false}
    ${"23:59:59"} | ${"00:00:00"} | ${false}   | ${false}
    ${"12:01:00"} | ${"12:00:00"} | ${false}   | ${false}
  `(
    "returns $expected for reversed time range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidTimeRange({ value1, value2, options: { allowEqual } }),
      ).toEqual(expected);
    },
  );

  it.each`
    value1        | value2
    ${"invalid"}  | ${"12:00:00"}
    ${""}         | ${"12:00:00"}
    ${"25:00:00"} | ${"12:00:00"}
    ${"12:00:00"} | ${"invalid"}
    ${"12:00:00"} | ${""}
    ${"12:00:00"} | ${"25:00:00"}
    ${"invalid"}  | ${"invalid"}
    ${""}         | ${""}
  `(
    "returns false for malformed time: $value1, $value2",
    ({ value1, value2 }) => {
      expect(isValidTimeRange({ value1, value2 })).toBe(false);
    },
  );

  it.each`
    value1        | value2        | expected
    ${"23:59:60"} | ${"12:00:00"} | ${false}
    ${"12:00:00"} | ${"23:59:60"} | ${false}
  `(
    "returns $expected for leap-second input: $value1 vs $value2",
    ({ value1, value2, expected }) => {
      expect(isValidTimeRange({ value1, value2 })).toBe(expected);
    },
  );

  it.each`
    value1        | value2
    ${null}       | ${"12:00:00"}
    ${undefined}  | ${"12:00:00"}
    ${123}        | ${"12:00:00"}
    ${true}       | ${"12:00:00"}
    ${[]}         | ${"12:00:00"}
    ${{}}         | ${"12:00:00"}
    ${"12:00:00"} | ${null}
    ${"12:00:00"} | ${undefined}
    ${"12:00:00"} | ${123}
    ${"12:00:00"} | ${true}
    ${"12:00:00"} | ${[]}
    ${"12:00:00"} | ${{}}
  `(
    "returns false for non-string input: $value1, $value2",
    ({ value1, value2 }) => {
      expect(
        isValidTimeRange({ value1: value1 as never, value2: value2 as never }),
      ).toBe(false);
    },
  );
});
