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

  // TC39 NudgeToZonedTime: rounding P3DT5H to an hour resolves +275760-09-13T19:00 in UTC, 19 hours
  // past the maximum, which GetPossibleEpochNanoseconds rejects (as it does for +00:00), so
  // Temporal throws. Five days earlier the same rounding gives P5DT5H: 5 whole days.
  it.each`
    value1                       | value2                       | expected
    ${"+275760-09-02T19:00:00Z"} | ${"+275760-09-08T00:00:00Z"} | ${5}
    ${"+275760-09-09T19:00:00Z"} | ${"+275760-09-13T00:00:00Z"} | ${null}
  `(
    "returns $expected days rounded to an hour from $value1 to $value2",
    ({ value1, value2, expected }) => {
      expect(diffUtc(value1, value2, "days", { smallestUnit: "hour" })).toBe(
        expected,
      );
    },
  );

  // The same rounding at the minimum (nsMinInstant is -271821-04-20T00:00:00Z). From min + 2d5h back
  // to min, TC39 DifferenceZonedDateTime gives -P2DT5H and NudgeToZonedTime resolves the end of the
  // day window, -271821-04-19T05:00 in UTC, 19 hours before the minimum, which
  // GetPossibleEpochNanoseconds rejects. Five days later the window stays in range: -P2DT5H.
  it.each`
    value1                       | value2                       | expected
    ${"-271821-04-27T05:00:00Z"} | ${"-271821-04-25T00:00:00Z"} | ${-2}
    ${"-271821-04-22T05:00:00Z"} | ${"-271821-04-20T00:00:00Z"} | ${null}
  `(
    "returns $expected days rounded to an hour from $value1 back to $value2",
    ({ value1, value2, expected }) => {
      expect(diffUtc(value1, value2, "days", { smallestUnit: "hour" })).toBe(
        expected,
      );
    },
  );

  // Temporal §13.17 GetTemporalUnitValuedOption: a singular unit name is the same unit as its plural.
  // One week apart: 7 days, 168 hours.
  it.each`
    unit               | expected
    ${"week"}          | ${1}
    ${"day"}           | ${7}
    ${"hour"}          | ${168}
    ${["week", "day"]} | ${{ weeks: 1, days: 0 }}
  `(
    "returns $expected for singular unit $unit from 2024-01-01T00:00:00Z to 2024-01-08T00:00:00Z",
    ({ unit, expected }) => {
      expect(
        diffUtc("2024-01-01T00:00:00Z", "2024-01-08T00:00:00Z", unit),
      ).toEqual(expected);
    },
  );
});

// Plan #16: a units array returns the whole difference; unlisted units between listed ones are
// carried into the next smaller listed unit. Values from native Temporal (Chromium 153), on the UTC
// clock: 2024-01-01T00:00Z until 2025-03-01T00:00Z is P1Y2M, and 2025-01-01 to 2025-03-01 is
// 59 days; 2024-01-01T00:00Z until 2024-01-03T02:30Z is P2DT2H30M (150 minutes); 2024-01-01T00:00Z
// until 2024-03-20T00:00Z is P2M19D, and Temporal fills weeks only for largestUnit weeks
// (2024-03-01 until 2024-03-20 is P2W5D).
describe("diffUtc units array carries unlisted units", () => {
  it.each`
    value1                    | value2                    | units                  | expected
    ${"2024-01-01T00:00:00Z"} | ${"2025-03-01T00:00:00Z"} | ${["years", "days"]}   | ${{ years: 1, days: 59 }}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-03T02:30:00Z"} | ${["day", "minute"]}   | ${{ days: 2, minutes: 150 }}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-03T02:30:00Z"} | ${["days", "hours"]}   | ${{ days: 2, hours: 2 }}
    ${"2024-01-01T00:00:00Z"} | ${"2024-03-20T00:00:00Z"} | ${["months", "weeks"]} | ${{ months: 2, weeks: 2 }}
  `(
    "returns $expected for $units from $value1 to $value2",
    ({ value1, value2, units, expected }) => {
      expect(diffUtc(value1, value2, units)).toEqual(expected);
    },
  );
});

// Temporal GetOptionsObject: an options argument that is not an object or undefined throws
// TypeError (native Chromium 153: `until(other, null)`, `"x"`, `5` and `true` all throw), so each is
// invalid input. Omitted options measure normally (PT49H).
describe("diffUtc with a non-object options argument", () => {
  it.each`
    options      | expected
    ${null}      | ${null}
    ${"x"}       | ${null}
    ${5}         | ${null}
    ${true}      | ${null}
    ${undefined} | ${49}
  `("returns $expected for options $options", ({ options, expected }) => {
    expect(
      diffUtc("2024-02-28T14:30:00Z", "2024-03-01T15:30:00Z", "hours", options),
    ).toBe(expected);
  });
});

// The result is a JavaScript number, so a nanosecond count past about 104 days
// (Number.MAX_SAFE_INTEGER / 86_400_000_000_000 = 104.2499...) stops being exact. Pinned so the
// JSDoc's "use spanNs / toNanoseconds for an exact count" stays true.
describe("diffUtc nanosecond precision past Number.MAX_SAFE_INTEGER", () => {
  it("is exact for a 104-day span", () => {
    expect(
      diffUtc("2024-01-01T00:00:00Z", "2024-04-14T00:00:00Z", "nanoseconds"),
    ).toBe(8_985_600_000_000_000);
  });

  it("loses the odd nanosecond past 104 days", () => {
    // The exact difference is 9072000000000001ns; a double cannot hold it.
    expect(
      diffUtc(
        "2024-01-01T00:00:00Z",
        "2024-04-15T00:00:00.000000001Z",
        "nanoseconds",
      ),
    ).toBe(9_072_000_000_000_000);
  });
});
