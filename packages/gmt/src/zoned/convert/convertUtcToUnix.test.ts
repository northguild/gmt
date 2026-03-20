import { convertUtcToUnix } from "./convertUtcToUnix";

describe("convertUtcToUnix", () => {
  it.each`
    value                     | unit              | expected
    ${"1970-01-01T00:00:00Z"} | ${"milliseconds"} | ${0}
    ${"1970-01-01T00:00:00Z"} | ${"seconds"}      | ${0}
    ${"2024-02-29T14:30:45Z"} | ${"milliseconds"} | ${1709217045000}
    ${"2024-02-29T14:30:45Z"} | ${"seconds"}      | ${1709217045}
  `("returns $expected for $value as $unit", ({ value, unit, expected }) => {
    expect(convertUtcToUnix(value, unit)).toBe(expected);
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
    ${undefined}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      convertUtcToUnix("2024-02-29T14:30:45Z", invalidUnit as never),
    ).toBeNull();
  });
});
