import { convertUtcDateTimeToUnix } from "./convertUtcDateTimeToUnix";

describe("convertUtcDateTimeToUnix", () => {
  it.each`
    value                        | unit              | expected
    ${"1970-01-01T00:00:00"}     | ${"milliseconds"} | ${0}
    ${"1970-01-01T00:00:00"}     | ${"seconds"}      | ${0}
    ${"2024-02-29T09:00:00"}     | ${"milliseconds"} | ${1709197200000}
    ${"2024-02-29T09:00:00"}     | ${"seconds"}      | ${1709197200}
    ${"2024-02-29T09:00:00.900"} | ${"milliseconds"} | ${1709197200900}
    ${"2024-02-29T09:00:00.900"} | ${"seconds"}      | ${1709197200}
    ${"2024-02-29T09:00:00.001"} | ${"milliseconds"} | ${1709197200001}
    ${"2024-02-29T09:00:00.001"} | ${"seconds"}      | ${1709197200}
  `("returns $expected for $value in $unit", ({ value, unit, expected }) => {
    expect(convertUtcDateTimeToUnix(value, unit)).toBe(expected);
  });

  it("defaults to milliseconds when unit is omitted", () => {
    expect(convertUtcDateTimeToUnix("2024-02-29T09:00:00")).toBe(1709197200000);
  });

  it.each`
    invalidValue
    ${"not-a-utc-datetime"}
    ${"2024-02-29"}
    ${"2024-02-29T09:00:00Z"}
    ${"2024-02-29T09:00:00+00:00[UTC]"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid value $invalidValue", ({ invalidValue }) => {
    expect(convertUtcDateTimeToUnix(invalidValue as never)).toBeNull();
  });

  it.each`
    invalidUnit
    ${"minutes"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      convertUtcDateTimeToUnix("2024-02-29T09:00:00", invalidUnit as never),
    ).toBeNull();
  });
});
