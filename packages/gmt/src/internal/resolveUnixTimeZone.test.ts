import { mockSystemTimeZone, battleTestTimeZones } from "../test";
import {
  isValidUnixEpochPair,
  resolveUnixTimeZone,
} from "./resolveUnixTimeZone";

describe("resolveUnixTimeZone", () => {
  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      expected: timeZone,
    })),
  )(
    "returns $expected for valid timeZone $timeZone",
    ({ timeZone, expected }) => {
      expect(resolveUnixTimeZone(timeZone)).toBe(expected);
    },
  );

  it("returns the system timeZone when input is undefined", () => {
    const restoreTimezone = mockSystemTimeZone("America/New_York");

    const result = resolveUnixTimeZone(undefined);
    expect(result).toBe("America/New_York");

    restoreTimezone();
  });

  it.each`
    timeZone        | reason
    ${""}           | ${"empty string"}
    ${"not-a-zone"} | ${"invalid IANA name"}
    ${"UTC+1"}      | ${"offset-based string"}
  `(
    "returns empty string for invalid timeZone $timeZone ($reason)",
    ({ timeZone }) => {
      expect(resolveUnixTimeZone(timeZone as never)).toBe("");
    },
  );

  it("returns empty string for null", () => {
    const restoreTimezone = mockSystemTimeZone("not-a-timezone");
    expect(resolveUnixTimeZone(null as never)).toBe("");
    restoreTimezone();
  });

  it("returns empty string for undefined when system timeZone is invalid", () => {
    const restoreTimezone = mockSystemTimeZone("not-a-timezone");
    expect(resolveUnixTimeZone(undefined)).toBe("");
    restoreTimezone();
  });
});

// Both epochs must be safe integers: past 2^53 consecutive integers are no longer distinct
// doubles (2 ** 53 + 1 === 2 ** 53), and every Temporal instant (±8.64e15 ms) is inside that range.
describe("isValidUnixEpochPair", () => {
  it.each`
    value1                     | value2                      | expected | description
    ${1704067200000}           | ${1704153600000}            | ${true}  | ${"two millisecond epochs"}
    ${-8640000000000000}       | ${8640000000000000}         | ${true}  | ${"the first and last Temporal instants"}
    ${Number.MAX_SAFE_INTEGER} | ${-Number.MAX_SAFE_INTEGER} | ${true}  | ${"the safe-integer limits"}
    ${2 ** 53}                 | ${0}                        | ${false} | ${"2^53, the first unsafe integer"}
    ${0}                       | ${-(2 ** 53)}               | ${false} | ${"-2^53"}
    ${1.5}                     | ${0}                        | ${false} | ${"a fraction"}
    ${NaN}                     | ${0}                        | ${false} | ${"NaN"}
    ${0}                       | ${Infinity}                 | ${false} | ${"Infinity"}
  `(
    "returns $expected for $value1 and $value2 ($description)",
    ({ value1, value2, expected }) => {
      expect(isValidUnixEpochPair(value1, value2)).toBe(expected);
    },
  );
});
