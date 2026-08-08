import { diffUtc } from "./diffUtc";

describe("diffUtc", () => {
  it.each`
    value1                    | value2                    | unit         | expected
    ${"2028-01-01T00:00:00Z"} | ${"2029-01-01T00:00:00Z"} | ${"years"}   | ${1}
    ${"2028-01-01T00:00:00Z"} | ${"2028-02-01T00:00:00Z"} | ${"months"}  | ${1}
    ${"2028-01-01T00:00:00Z"} | ${"2028-01-08T00:00:00Z"} | ${"weeks"}   | ${1}
    ${"2028-01-01T00:00:00Z"} | ${"2028-01-02T00:00:00Z"} | ${"days"}    | ${1}
    ${"2028-01-01T00:00:00Z"} | ${"2028-01-01T01:00:00Z"} | ${"hours"}   | ${1}
    ${"2028-01-01T00:00:00Z"} | ${"2028-01-01T00:01:00Z"} | ${"minutes"} | ${1}
    ${"2028-01-01T00:00:00Z"} | ${"2028-01-01T00:00:01Z"} | ${"seconds"} | ${1}
  `(
    "returns int $expected for single unit difference between $value1 and $value2 for unit $unit",
    ({ value1, value2, unit, expected }) => {
      expect(diffUtc(value1, value2, unit)).toEqual(expected);
    },
  );

  it.each`
    value1                    | value2                    | units                  | expected
    ${"2028-01-01T00:00:00Z"} | ${"2029-01-01T00:00:00Z"} | ${["years"]}           | ${{ years: 1 }}
    ${"2028-01-01T00:00:00Z"} | ${"2028-02-01T00:00:00Z"} | ${["months"]}          | ${{ months: 1 }}
    ${"2028-01-01T00:00:00Z"} | ${"2028-01-08T00:00:00Z"} | ${["weeks"]}           | ${{ weeks: 1 }}
    ${"2028-01-01T00:00:00Z"} | ${"2028-01-02T00:00:00Z"} | ${["days"]}            | ${{ days: 1 }}
    ${"2028-01-01T00:00:00Z"} | ${"2028-01-01T01:00:00Z"} | ${["hours"]}           | ${{ hours: 1 }}
    ${"2028-01-01T00:00:00Z"} | ${"2029-01-01T00:00:00Z"} | ${["years", "months"]} | ${{ years: 1, months: 0 }}
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
    roundingMode    | expected
    ${"ceil"}       | ${2}
    ${"floor"}      | ${1}
    ${"trunc"}      | ${1}
    ${"halfExpand"} | ${2}
  `(
    "rounds a 90-minute span to $expected hours with smallestUnit hour, roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        diffUtc("2028-01-01T00:00:00Z", "2028-01-01T01:30:00Z", "hours", {
          smallestUnit: "hours",
          roundingMode,
        }),
      ).toBe(expected);
    },
  );

  it("returns the unrounded result when no rounding options are provided", () => {
    expect(
      diffUtc("2028-01-01T00:00:00Z", "2028-01-01T01:40:00Z", "minutes"),
    ).toBe(100);
  });

  it("returns null when roundingIncrement does not evenly divide the unit (minutes must divide 60)", () => {
    expect(
      diffUtc("2028-01-01T00:00:00Z", "2028-01-01T01:30:00Z", "minutes", {
        smallestUnit: "minutes",
        roundingIncrement: 7,
        roundingMode: "trunc",
      }),
    ).toBeNull();
  });

  it("rounds a negative diff (value1 after value2)", () => {
    expect(
      diffUtc("2028-01-01T01:30:00Z", "2028-01-01T00:00:00Z", "hours", {
        smallestUnit: "hours",
        roundingMode: "halfExpand",
      }),
    ).toBe(-2);
  });

  it("rounds a result requested as an array of units", () => {
    expect(
      diffUtc(
        "2028-01-01T00:00:00Z",
        "2028-01-01T01:45:00Z",
        ["hours", "minutes"],
        {
          smallestUnit: "minutes",
          roundingIncrement: 30,
          roundingMode: "halfExpand",
        },
      ),
    ).toEqual({ hours: 2, minutes: 0 });
  });

  it("returns the unrounded array-of-units result when no options are provided", () => {
    expect(
      diffUtc("2028-01-01T00:00:00Z", "2028-01-01T01:45:00Z", [
        "hours",
        "minutes",
      ]),
    ).toEqual({ hours: 1, minutes: 45 });
  });

  it("returns null when smallestUnit is coarser than the largest requested unit", () => {
    expect(
      diffUtc(
        "2028-01-01T00:00:00Z",
        "2028-01-01T01:45:00Z",
        ["minutes", "seconds"],
        { smallestUnit: "hours" },
      ),
    ).toBeNull();
  });
});
