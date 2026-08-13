import { diffUtcAsDuration } from "./diffUtcAsDuration";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("diffUtcAsDuration", () => {
  // Canonical input: utcStart2024Jan01StartOfDay
  const canonicalInput = "2024-01-01T00:00:00Z";

  it.each`
    value1            | value2                    | unit         | expected
    ${canonicalInput} | ${"2025-01-01T00:00:00Z"} | ${"years"}   | ${"P1Y"}
    ${canonicalInput} | ${"2024-02-01T00:00:00Z"} | ${"months"}  | ${"P1M"}
    ${canonicalInput} | ${"2024-01-08T00:00:00Z"} | ${"weeks"}   | ${"P1W"}
    ${canonicalInput} | ${"2024-01-02T00:00:00Z"} | ${"days"}    | ${"P1D"}
    ${canonicalInput} | ${"2024-01-01T01:00:00Z"} | ${"hours"}   | ${"PT1H"}
    ${canonicalInput} | ${"2024-01-01T00:01:00Z"} | ${"minutes"} | ${"PT1M"}
    ${canonicalInput} | ${"2024-01-01T00:00:01Z"} | ${"seconds"} | ${"PT1S"}
  `(
    "returns $expected for $unit difference between $value1 and $value2",
    ({ value1, value2, unit, expected }) => {
      expect(diffUtcAsDuration(value1, value2, unit)).toBe(expected);
    },
  );

  it.each`
    value1                    | value2                    | unit       | expected
    ${"2024-03-10T12:00:00Z"} | ${"2024-03-11T12:00:00Z"} | ${"hours"} | ${"PT24H"}
    ${"2024-03-11T12:00:00Z"} | ${"2024-03-10T12:00:00Z"} | ${"hours"} | ${"-PT24H"}
    ${canonicalInput}         | ${canonicalInput}         | ${"hours"} | ${"PT0S"}
  `(
    "returns $expected for $unit difference between $value1 and $value2",
    ({ value1, value2, unit, expected }) => {
      expect(diffUtcAsDuration(value1, value2, unit)).toBe(expected);
    },
  );

  it.each`
    value1                    | value2                    | unit
    ${"invalid"}              | ${"2024-03-01T00:00:00Z"} | ${"days"}
    ${"2024-03-01T00:00:00Z"} | ${"invalid"}              | ${"days"}
    ${""}                     | ${"2024-03-01T00:00:00Z"} | ${"days"}
    ${null}                   | ${"2024-03-01T00:00:00Z"} | ${"days"}
    ${"2024-03-01T00:00:00Z"} | ${"2024-03-02T00:00:00Z"} | ${"invalid"}
    ${"2024-03-01T00:00:00Z"} | ${"2024-03-02T00:00:00Z"} | ${["days"]}
  `(
    'returns "" for invalid inputs: $value1 | $value2 | $unit',
    ({ value1, value2, unit }) => {
      expect(
        diffUtcAsDuration(value1 as never, value2 as never, unit as never),
      ).toBe("");
    },
  );

  it.each`
    value1            | value2                    | unit       | smallestUnit | roundingMode    | expected
    ${canonicalInput} | ${"2024-01-01T01:30:00Z"} | ${"hours"} | ${"hours"}   | ${"ceil"}       | ${"PT2H"}
    ${canonicalInput} | ${"2024-01-01T01:30:00Z"} | ${"hours"} | ${"hours"}   | ${"floor"}      | ${"PT1H"}
    ${canonicalInput} | ${"2024-01-01T01:30:00Z"} | ${"hours"} | ${"hours"}   | ${"trunc"}      | ${"PT1H"}
    ${canonicalInput} | ${"2024-01-01T01:30:00Z"} | ${"hours"} | ${"hours"}   | ${"halfExpand"} | ${"PT2H"}
  `(
    "returns $expected for $unit difference with smallestUnit $smallestUnit and roundingMode $roundingMode",
    ({ value1, value2, unit, smallestUnit, roundingMode, expected }) => {
      expect(
        diffUtcAsDuration(value1, value2, unit, { smallestUnit, roundingMode }),
      ).toBe(expected);
    },
  );

  it.each`
    value1            | value2                    | unit         | expected
    ${canonicalInput} | ${"2024-01-01T01:40:00Z"} | ${"minutes"} | ${"PT100M"}
    ${canonicalInput} | ${canonicalInput}         | ${"minutes"} | ${"PT0S"}
  `(
    "returns $expected for $unit difference between $value1 and $value2 with no rounding",
    ({ value1, value2, unit, expected }) => {
      expect(diffUtcAsDuration(value1, value2, unit)).toBe(expected);
    },
  );

  it.each`
    value1            | value2                    | unit         | smallestUnit | roundingIncrement | roundingMode
    ${canonicalInput} | ${"2024-01-01T01:30:00Z"} | ${"minutes"} | ${"minutes"} | ${7}              | ${"trunc"}
  `(
    'returns "" when roundingIncrement does not evenly divide the unit',
    ({
      value1,
      value2,
      unit,
      smallestUnit,
      roundingIncrement,
      roundingMode,
    }) => {
      expect(
        diffUtcAsDuration(value1, value2, unit, {
          smallestUnit,
          roundingIncrement,
          roundingMode,
        }),
      ).toBe("");
    },
  );

  it.each`
    value1            | value2                    | unit       | toStringSmallestUnit | fractionalSecondDigits | expected
    ${canonicalInput} | ${"2024-01-01T01:00:00Z"} | ${"hours"} | ${undefined}         | ${undefined}           | ${"PT1H"}
    ${canonicalInput} | ${"2024-01-01T01:00:00Z"} | ${"hours"} | ${"second"}          | ${undefined}           | ${"PT1H0S"}
    ${canonicalInput} | ${"2024-01-01T01:00:00Z"} | ${"hours"} | ${undefined}         | ${3}                   | ${"PT1H0.000S"}
  `(
    "returns $expected with toString precision options",
    ({
      value1,
      value2,
      unit,
      toStringSmallestUnit,
      fractionalSecondDigits,
      expected,
    }) => {
      expect(
        diffUtcAsDuration(value1, value2, unit, {
          toStringSmallestUnit,
          fractionalSecondDigits,
        }),
      ).toBe(expected);
    },
  );

  it("returns empty string when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      diffUtcAsDuration(canonicalInput, "2024-01-02T00:00:00Z", "days"),
    ).toBe("");
  });
});
