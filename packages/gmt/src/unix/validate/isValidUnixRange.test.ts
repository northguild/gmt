import { isValidUnixRange } from "./isValidUnixRange";

describe("isValidUnixRange", () => {
  it.each`
    value1        | value2          | allowEqual | expected
    ${1704067200} | ${1735689599}   | ${false}   | ${true}
    ${-86400}     | ${0}            | ${false}   | ${true}
    ${1704067200} | ${1735689599}   | ${true}    | ${true}
    ${"0"}        | ${"1704067200"} | ${false}   | ${true}
  `(
    "returns $expected for valid Unix range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidUnixRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1        | value2        | allowEqual | expected
    ${1704067200} | ${1704067200} | ${false}   | ${false}
    ${1704067200} | ${1704067200} | ${true}    | ${true}
  `(
    "returns $expected for equal Unix values $value1 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidUnixRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1        | value2  | expected
    ${1735689599} | ${0}    | ${false}
    ${1704067200} | ${1000} | ${false}
  `(
    "returns $expected for reversed Unix range $value1 to $value2",
    ({ value1, value2, expected }) => {
      expect(isValidUnixRange({ value1, value2 })).toBe(expected);
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
    value1        | value2     | allowEqual | reason
    ${0}          | ${1.5}     | ${false}   | ${"fractional value2"}
    ${0.5}        | ${2}       | ${true}    | ${"fractional value1"}
    ${"0"}        | ${"1.5"}   | ${false}   | ${"fractional numeric string"}
    ${0}          | ${2 ** 53} | ${false}   | ${"2^53 is not a safe integer"}
    ${-(2 ** 53)} | ${0}       | ${true}    | ${"-2^53 is not a safe integer"}
    ${""}         | ${1000}    | ${false}   | ${"empty string is not epoch 0"}
    ${0}          | ${"   "}   | ${true}    | ${"whitespace string is not epoch 0"}
  `(
    "returns false for a non-safe-integer epoch: $value1, $value2 (allowEqual=$allowEqual, $reason)",
    ({ value1, value2, allowEqual }) => {
      expect(
        isValidUnixRange({ value1, value2, options: { allowEqual } }),
      ).toBe(false);
    },
  );

  it.each`
    value1                      | value2                     | allowEqual | expected | reason
    ${-Number.MAX_SAFE_INTEGER} | ${Number.MAX_SAFE_INTEGER} | ${false}   | ${true}  | ${"both safe-integer limits"}
    ${"-86400"}                 | ${"1000"}                  | ${false}   | ${true}  | ${"digit strings read as epochs"}
    ${"-86400"}                 | ${"1e3"}                   | ${false}   | ${false} | ${"exponent notation is not an epoch"}
    ${" 1"}                     | ${"2"}                     | ${false}   | ${false} | ${"a padded string is not an epoch"}
    ${"+1"}                     | ${"2"}                     | ${false}   | ${false} | ${"a plus sign is not an epoch"}
    ${""}                       | ${""}                      | ${true}    | ${false} | ${"empty strings are never an equal pair"}
  `(
    "returns $expected for epochs $value1, $value2 (allowEqual=$allowEqual, $reason)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidUnixRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1       | value2
    ${null}      | ${1000}
    ${undefined} | ${1000}
    ${"abc"}     | ${1000}
    ${1000}      | ${null}
    ${1000}      | ${undefined}
    ${1000}      | ${"abc"}
  `(
    "returns false for non-numeric input: $value1, $value2",
    ({ value1, value2 }) => {
      expect(
        isValidUnixRange({
          value1: value1 as never,
          value2: value2 as never,
        }),
      ).toBe(false);
    },
  );
});
