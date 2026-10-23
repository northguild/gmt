import { fromArrowLocalTimestamp } from "./fromArrowLocalTimestamp";

describe("fromArrowLocalTimestamp", () => {
  it.each`
    value                         | unit              | expected
    ${0n}                         | ${"second"}       | ${"1970-01-01T00:00:00"}
    ${1_704_067_200_000n}         | ${"milliseconds"} | ${"2024-01-01T00:00:00"}
    ${1_704_067_200_123n}         | ${"millisecond"}  | ${"2024-01-01T00:00:00.123"}
    ${1_704_067_200_123_456n}     | ${"microsecond"}  | ${"2024-01-01T00:00:00.123456"}
    ${1_704_067_200_123_456n}     | ${"microseconds"} | ${"2024-01-01T00:00:00.123456"}
    ${1_704_067_200_000_000_001n} | ${"nanoseconds"}  | ${"2024-01-01T00:00:00.000000001"}
    ${1_704_067_200n}             | ${"second"}       | ${"2024-01-01T00:00:00"}
    ${1_704_067_200_123n}         | ${"milliseconds"} | ${"2024-01-01T00:00:00.123"}
    ${1_704_067_200_123_456_789n} | ${"nanosecond"}   | ${"2024-01-01T00:00:00.123456789"}
    ${1_709_164_800n}             | ${"seconds"}      | ${"2024-02-29T00:00:00"}
    ${-1n}                        | ${"nanosecond"}   | ${"1969-12-31T23:59:59.999999999"}
    ${-1n}                        | ${"second"}       | ${"1969-12-31T23:59:59"}
    ${-1n}                        | ${"millisecond"}  | ${"1969-12-31T23:59:59.999"}
    ${-86_400_000n}               | ${"milliseconds"} | ${"1969-12-31T00:00:00"}
    ${2n ** 63n - 1n}             | ${"nanosecond"}   | ${"2262-04-11T23:47:16.854775807"}
    ${-(2n ** 63n)}               | ${"nanosecond"}   | ${"1677-09-21T00:12:43.145224192"}
    ${8_640_000_000_000n}         | ${"second"}       | ${"+275760-09-13T00:00:00"}
    ${-8_640_000_000_000n}        | ${"second"}       | ${"-271821-04-20T00:00:00"}
  `("returns $expected for $value $unit", ({ value, unit, expected }) => {
    expect(fromArrowLocalTimestamp(value, unit)).toBe(expected);
  });

  it.each`
    value                  | unit
    ${8_640_000_000_001n}  | ${"second"}
    ${-8_640_000_000_001n} | ${"second"}
    ${-(2n ** 63n)}        | ${"second"}
    ${2n ** 63n - 1n}      | ${"second"}
    ${2n ** 63n}           | ${"nanosecond"}
    ${-(2n ** 63n) - 1n}   | ${"nanosecond"}
    ${undefined}           | ${"second"}
    ${null}                | ${"second"}
    ${0}                   | ${"second"}
    ${"0"}                 | ${"second"}
    ${0n}                  | ${"toString"}
    ${0n}                  | ${"s"}
    ${0n}                  | ${undefined}
    ${0n}                  | ${"Second"}
    ${0n}                  | ${"SECOND"}
    ${0n}                  | ${"day"}
    ${0n}                  | ${"secondss"}
    ${2n ** 63n}           | ${"microsecond"}
    ${-(2n ** 63n) - 1n}   | ${"microsecond"}
    ${1_704_067_200n}      | ${{ unit: "second" }}
  `("returns an empty string for $value $unit", ({ value, unit }) => {
    expect(fromArrowLocalTimestamp(value, unit)).toBe("");
  });
});
