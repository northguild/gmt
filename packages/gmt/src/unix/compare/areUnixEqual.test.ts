import { areUnixEqual } from "./areUnixEqual";

describe("areUnixEqual", () => {
  it.each`
    value1        | value2        | expected
    ${1706659200} | ${1706659200} | ${true}
    ${1704067200} | ${1706659200} | ${false}
    ${1706659200} | ${1704067200} | ${false}
  `(
    "returns $expected when checking if $value1 equals $value2",
    ({ value1, value2, expected }) => {
      expect(areUnixEqual(value1, value2, { epochUnit: "seconds" })).toBe(
        expected,
      );
    },
  );

  it.each`
    value1           | value2           | epochUnit         | expected
    ${1706659200}    | ${1706659200}    | ${"seconds"}      | ${true}
    ${1706659200000} | ${1706659200000} | ${"milliseconds"} | ${true}
    ${1706659200}    | ${1704067200}    | ${"seconds"}      | ${false}
  `(
    "returns $expected for value $value1 and $value2 with epochUnit $epochUnit",
    ({ value1, value2, epochUnit, expected }) => {
      expect(
        areUnixEqual(value1, value2, { epochUnit: epochUnit as never }),
      ).toBe(expected);
    },
  );

  it.each`
    value1        | value2
    ${"invalid"}  | ${1706659200}
    ${1706659200} | ${"invalid"}
    ${-1}         | ${1706659200}
    ${1706659200} | ${-1}
    ${null}       | ${1706659200}
  `(
    "returns false for invalid inputs: $value1 | $value2",
    ({ value1, value2 }) => {
      expect(areUnixEqual(value1 as never, value2 as never)).toBe(false);
    },
  );
});
