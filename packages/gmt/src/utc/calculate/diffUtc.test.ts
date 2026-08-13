import { diffUtc } from "./diffUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("diffUtc", () => {
  // Canonical input: utcStart2024Jan01StartOfDay
  const canonicalInput = "2024-01-01T00:00:00Z";

  it.each`
    value1            | value2                    | unit         | expected
    ${canonicalInput} | ${"2025-01-01T00:00:00Z"} | ${"years"}   | ${1}
    ${canonicalInput} | ${"2024-02-01T00:00:00Z"} | ${"months"}  | ${1}
    ${canonicalInput} | ${"2024-01-08T00:00:00Z"} | ${"weeks"}   | ${1}
    ${canonicalInput} | ${"2024-01-02T00:00:00Z"} | ${"days"}    | ${1}
    ${canonicalInput} | ${"2024-01-01T01:00:00Z"} | ${"hours"}   | ${1}
    ${canonicalInput} | ${"2024-01-01T00:01:00Z"} | ${"minutes"} | ${1}
    ${canonicalInput} | ${"2024-01-01T00:00:01Z"} | ${"seconds"} | ${1}
  `(
    "returns $expected for $unit difference between $value1 and $value2",
    ({ value1, value2, unit, expected }) => {
      expect(diffUtc(value1, value2, unit)).toEqual(expected);
    },
  );

  it.each`
    value1            | value2                    | units                  | expected
    ${canonicalInput} | ${"2025-01-01T00:00:00Z"} | ${["years"]}           | ${{ years: 1 }}
    ${canonicalInput} | ${"2024-02-01T00:00:00Z"} | ${["months"]}          | ${{ months: 1 }}
    ${canonicalInput} | ${"2024-01-08T00:00:00Z"} | ${["weeks"]}           | ${{ weeks: 1 }}
    ${canonicalInput} | ${"2024-01-02T00:00:00Z"} | ${["days"]}            | ${{ days: 1 }}
    ${canonicalInput} | ${"2024-01-01T01:00:00Z"} | ${["hours"]}           | ${{ hours: 1 }}
    ${canonicalInput} | ${"2025-01-01T00:00:00Z"} | ${["years", "months"]} | ${{ years: 1, months: 0 }}
  `(
    "returns $expected for $units difference between $value1 and $value2",
    ({ value1, value2, units, expected }) => {
      expect(diffUtc(value1, value2, units)).toEqual(expected);
    },
  );

  it.each`
    value1                    | value2
    ${"invalid"}              | ${"2024-03-01T00:00:00Z"}
    ${"2024-03-01T00:00:00Z"} | ${"invalid"}
    ${""}                     | ${"2024-03-01T00:00:00Z"}
    ${null}                   | ${"2024-03-01T00:00:00Z"}
  `(
    "returns null for invalid inputs: $value1 | $value2",
    ({ value1, value2 }) => {
      expect(diffUtc(value1 as never, value2 as never, "days" as never)).toBe(
        null,
      );
    },
  );

  it.each`
    value1                    | value2                    | unit       | smallestUnit | roundingMode    | expected
    ${canonicalInput}         | ${"2024-01-01T01:30:00Z"} | ${"hours"} | ${"hours"}   | ${"ceil"}       | ${2}
    ${canonicalInput}         | ${"2024-01-01T01:30:00Z"} | ${"hours"} | ${"hours"}   | ${"floor"}      | ${1}
    ${canonicalInput}         | ${"2024-01-01T01:30:00Z"} | ${"hours"} | ${"hours"}   | ${"trunc"}      | ${1}
    ${canonicalInput}         | ${"2024-01-01T01:30:00Z"} | ${"hours"} | ${"hours"}   | ${"halfExpand"} | ${2}
    ${"2024-01-01T01:30:00Z"} | ${canonicalInput}         | ${"hours"} | ${"hours"}   | ${"halfExpand"} | ${-2}
  `(
    "returns $expected for $unit difference with smallestUnit $smallestUnit and roundingMode $roundingMode",
    ({ value1, value2, unit, smallestUnit, roundingMode, expected }) => {
      expect(
        diffUtc(value1, value2, unit, { smallestUnit, roundingMode }),
      ).toBe(expected);
    },
  );

  it.each`
    value1            | value2                    | unit         | expected
    ${canonicalInput} | ${"2024-01-01T01:40:00Z"} | ${"minutes"} | ${100}
    ${canonicalInput} | ${"2024-01-01T00:00:00Z"} | ${"minutes"} | ${0}
  `(
    "returns $expected for $unit difference between $value1 and $value2 with no rounding",
    ({ value1, value2, unit, expected }) => {
      expect(diffUtc(value1, value2, unit)).toBe(expected);
    },
  );

  it.each`
    value1            | value2                    | units                   | smallestUnit | roundingIncrement | roundingMode    | expected
    ${canonicalInput} | ${"2024-01-01T01:45:00Z"} | ${["hours", "minutes"]} | ${"minutes"} | ${30}             | ${"halfExpand"} | ${{ hours: 2, minutes: 0 }}
  `(
    "returns $expected for $units difference with rounding options",
    ({
      value1,
      value2,
      units,
      smallestUnit,
      roundingIncrement,
      roundingMode,
      expected,
    }) => {
      expect(
        diffUtc(value1, value2, units, {
          smallestUnit,
          roundingIncrement,
          roundingMode,
        }),
      ).toEqual(expected);
    },
  );

  it.each`
    value1            | value2                    | units                     | smallestUnit | expected
    ${canonicalInput} | ${"2024-01-01T01:45:00Z"} | ${["minutes", "seconds"]} | ${"hours"}   | ${null}
  `(
    "returns null when smallestUnit is coarser than largest unit",
    ({ value1, value2, units, smallestUnit }) => {
      expect(diffUtc(value1, value2, units, { smallestUnit })).toBeNull();
    },
  );

  it.each`
    value1            | value2                    | unit         | smallestUnit | roundingIncrement | roundingMode
    ${canonicalInput} | ${"2024-01-01T01:30:00Z"} | ${"minutes"} | ${"minutes"} | ${7}              | ${"trunc"}
  `(
    "returns null when roundingIncrement does not evenly divide the unit",
    ({
      value1,
      value2,
      unit,
      smallestUnit,
      roundingIncrement,
      roundingMode,
    }) => {
      expect(
        diffUtc(value1, value2, unit, {
          smallestUnit,
          roundingIncrement,
          roundingMode,
        }),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(diffUtc(canonicalInput, "2024-01-02T00:00:00Z", "days")).toBeNull();
  });
});
