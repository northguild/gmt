import { isAfterUnix } from "./isAfterUnix";

describe("isAfterUnix", () => {
  it.each`
    value1        | value2        | expected
    ${1706659200} | ${1704067200} | ${true}
    ${1704067200} | ${1706659200} | ${false}
    ${1706659200} | ${1706659200} | ${false}
  `(
    "returns $expected when checking if $value1 is after $value2",
    ({ value1, value2, expected }) => {
      expect(isAfterUnix(value1, value2, { epochUnit: "seconds" })).toBe(
        expected,
      );
    },
  );

  it.each`
    value1           | value2          | epochUnit         | expected
    ${1706659200}    | ${1704067200}   | ${"seconds"}      | ${true}
    ${1706659200000} | ${170406720000} | ${"milliseconds"} | ${true}
    ${1704067200}    | ${1706659200}   | ${"seconds"}      | ${false}
    ${1706659200}    | ${1706659200}   | ${"seconds"}      | ${false}
  `(
    "returns $expected for value $value1 and $value2 with epochUnit $epochUnit",
    ({ value1, value2, epochUnit, expected }) => {
      expect(
        isAfterUnix(value1, value2, { epochUnit: epochUnit as never }),
      ).toBe(expected);
    },
  );

  it.each`
    value1        | value2
    ${"invalid"}  | ${1706659200}
    ${1706659200} | ${"invalid"}
    ${null}       | ${1706659200}
  `(
    "returns false for invalid inputs: $value1 | $value2",
    ({ value1, value2 }) => {
      expect(isAfterUnix(value1 as never, value2 as never)).toBe(false);
    },
  );
});
