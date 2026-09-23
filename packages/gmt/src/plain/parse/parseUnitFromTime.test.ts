import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { parseUnitFromTime } from "./parseUnitFromTime";

describe("parseUnitFromTime", () => {
  it.each`
    value             | unit             | expected
    ${"14:30:45.123"} | ${"hour"}        | ${"14"}
    ${"14:30:45.123"} | ${"minute"}      | ${"30"}
    ${"14:30:45.123"} | ${"second"}      | ${"45"}
    ${"14:30:45.123"} | ${"millisecond"} | ${"123"}
  `("returns $expected for valid unit $unit", ({ value, unit, expected }) => {
    expect(parseUnitFromTime(value, unit)).toBe(expected);
  });

  it.each`
    value             | unit             | expected
    ${"00:00:00.001"} | ${"millisecond"} | ${"001"}
    ${"23:59:59"}     | ${"hour"}        | ${"23"}
    ${"08:05:09"}     | ${"minute"}      | ${"05"}
  `(
    "returns $expected for edge case unit $unit",
    ({ value, unit, expected }) => {
      expect(parseUnitFromTime(value, unit)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"not-a-time"}
    ${"24:00:00"}
    ${"2024-02-29T14:30:45"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid time $invalidValue",
    ({ invalidValue }) => {
      expect(parseUnitFromTime(invalidValue as never, "hour")).toBe("");
    },
  );

  it.each`
    unit            | expected
    ${"day"}        | ${""}
    ${"picosecond"} | ${""}
    ${""}           | ${""}
    ${null}         | ${""}
    ${undefined}    | ${""}
  `("returns an empty string for invalid unit $unit", ({ unit, expected }) => {
    expect(parseUnitFromTime("14:30:45.123", unit as never)).toBe(expected);
  });

  it("returns an empty string on failure", () => {
    mockTemporalPlainTimeFromThrow();
    const result = parseUnitFromTime("14:30:45.123", "hour");
    expect(result).toBe("");
  });

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  it.each`
    unit              | expected
    ${"hours"}        | ${"13"}
    ${"minutes"}      | ${"45"}
    ${"seconds"}      | ${"30"}
    ${"milliseconds"} | ${"123"}
  `(
    "returns $expected for plural unit $unit of 13:45:30.123456789",
    ({ unit, expected }) => {
      expect(parseUnitFromTime("13:45:30.123456789", unit)).toBe(expected);
    },
  );
});

// Every family with a time reads the three sub-second Temporal fields (0-999 each), zero-padded to
// 3 digits like parseMillisecondFrom*/parseMicrosecondFrom*/parseNanosecondFrom*. Native Chromium
// 153 reads .000001002 as millisecond 0, microsecond 1, nanosecond 2.
describe("parseUnitFromTime sub-second units", () => {
  it.each`
    unit              | expected
    ${"millisecond"}  | ${"000"}
    ${"milliseconds"} | ${"000"}
    ${"microsecond"}  | ${"001"}
    ${"microseconds"} | ${"001"}
    ${"nanosecond"}   | ${"002"}
    ${"nanoseconds"}  | ${"002"}
  `(
    "returns $expected for unit $unit of 14:30:45.000001002",
    ({ unit, expected }) => {
      expect(parseUnitFromTime("14:30:45.000001002", unit)).toBe(expected);
    },
  );
});
