import { isValidUnixRange } from "./isValidUnixRange";

describe("isValidUnixRange", () => {
  it.each`
    value1    | value2          | allowEqual | expected
    ${0}      | ${1700000000}   | ${false}   | ${true}
    ${-86400} | ${0}            | ${false}   | ${true}
    ${1000}   | ${2000}         | ${false}   | ${true}
    ${"0"}    | ${"1700000000"} | ${false}   | ${true}
  `(
    "returns $expected for valid Unix range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidUnixRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1  | value2  | allowEqual | expected
    ${1000} | ${1000} | ${false}   | ${false}
    ${1000} | ${1000} | ${true}    | ${true}
  `(
    "returns $expected for equal Unix values $value1 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidUnixRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1        | value2  | allowEqual | expected
    ${1700000000} | ${0}    | ${false}   | ${false}
    ${2000}       | ${1000} | ${false}   | ${false}
  `(
    "returns $expected for reversed Unix range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidUnixRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1       | value2
    ${NaN}       | ${1000}
    ${Infinity}  | ${1000}
    ${-Infinity} | ${1000}
    ${1000}      | ${NaN}
    ${1000}      | ${Infinity}
    ${1000}      | ${-Infinity}
  `(
    "returns false for non-finite Unix: $value1, $value2",
    ({ value1, value2 }) => {
      expect(isValidUnixRange({ value1, value2 })).toBe(false);
    },
  );

  it.each`
    value1       | value2
    ${null}      | ${1000}
    ${undefined} | ${1000}
    ${"abc"}     | ${1000}
    ${"1000"}    | ${null}
    ${"1000"}    | ${undefined}
    ${"1000"}    | ${"abc"}
  `(
    "returns false for non-numeric input: $value1, $value2",
    ({ value1, value2 }) => {
      expect(
        isValidUnixRange({ value1: value1 as never, value2: value2 as never }),
      ).toBe(false);
    },
  );
});
