import { convertUtcToUnix } from "./convertUtcToUnix";

describe("convertUtcToUnix", () => {
  it.each`
    value                     | unit              | expected
    ${"1970-01-01T00:00:00Z"} | ${"milliseconds"} | ${0}
    ${"1970-01-01T00:00:00Z"} | ${"seconds"}      | ${0}
    ${"2024-02-29T14:30:45Z"} | ${"milliseconds"} | ${1709217045000}
    ${"2024-02-29T14:30:45Z"} | ${"seconds"}      | ${1709217045}
  `("returns $expected for $value as $unit", ({ value, unit, expected }) => {
    expect(convertUtcToUnix(value, { epochUnit: unit })).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-29T14:30:45"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns null for invalid UTC datetime $invalidValue",
    ({ invalidValue }) => {
      expect(convertUtcToUnix(invalidValue as never)).toBeNull();
    },
  );

  it.each`
    invalidUnit
    ${"minutes"}
    ${""}
    ${null}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      convertUtcToUnix("2024-02-29T14:30:45Z", {
        epochUnit: invalidUnit as never,
      }),
    ).toBeNull();
  });

  // Seconds floor toward -Infinity: 1969-12-31T23:59:59.5Z is second -1 (POSIX time_t).
  it.each`
    value                       | options                         | expected
    ${"2024-02-29T14:30:45Z"}   | ${undefined}                    | ${1709217045000}
    ${"2024-02-29T14:30:45Z"}   | ${{ epochUnit: undefined }}     | ${1709217045000}
    ${"2024-02-29T14:30:45Z"}   | ${{ epochUnit: "millisecond" }} | ${1709217045000}
    ${"2024-02-29T14:30:45Z"}   | ${{ epochUnit: "second" }}      | ${1709217045}
    ${"1969-12-31T23:59:59.5Z"} | ${{ epochUnit: "second" }}      | ${-1}
  `(
    "returns $expected for $value with options $options",
    ({ value, options, expected }) => {
      expect(convertUtcToUnix(value, options)).toBe(expected);
    },
  );

  // The unit is an options object; a legacy positional unit string (or null) is not an options
  // object (Temporal GetOptionsObject throws TypeError), so it is the sentinel, never a silent
  // default. An explicit undefined is the same as omitted.
  it.each`
    options
    ${"seconds"}
    ${"milliseconds"}
    ${null}
    ${1000}
  `("returns the sentinel for non-object options $options", ({ options }) => {
    expect(convertUtcToUnix("2024-02-29T14:30:45Z", options as never)).toBe(
      null,
    );
  });
});
