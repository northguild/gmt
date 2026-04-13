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
});
