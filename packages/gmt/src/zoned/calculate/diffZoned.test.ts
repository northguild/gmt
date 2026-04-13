import { diffZoned } from "./diffZoned";

describe("diffZonedDateTime", () => {
  it.each`
    value1                                  | value2                                  | unit              | expected
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2029-01-01T00:00:00+00:00[UTC]"}     | ${"years"}        | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-02-01T00:00:00+00:00[UTC]"}     | ${"months"}       | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-08T00:00:00+00:00[UTC]"}     | ${"weeks"}        | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-02T00:00:00+00:00[UTC]"}     | ${"days"}         | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T01:00:00+00:00[UTC]"}     | ${"hours"}        | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T00:01:00+00:00[UTC]"}     | ${"minutes"}      | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T00:00:01+00:00[UTC]"}     | ${"seconds"}      | ${1}
    ${"2028-01-01T00:00:00.000+00:00[UTC]"} | ${"2028-01-01T00:00:00.001+00:00[UTC]"} | ${"milliseconds"} | ${1}
  `(
    "returns int $expected for single unit difference between $value1 and $value2 for unit $unit",
    ({ value1, value2, unit, expected }) => {
      expect(diffZoned(value1, value2, unit)).toEqual(expected);
    },
  );

  it.each`
    value1                                  | value2                                  | units                  | expected
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2029-01-01T00:00:00+00:00[UTC]"}     | ${["years"]}           | ${{ years: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-02-01T00:00:00+00:00[UTC]"}     | ${["months"]}          | ${{ months: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-08T00:00:00+00:00[UTC]"}     | ${["weeks"]}           | ${{ weeks: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-02T00:00:00+00:00[UTC]"}     | ${["days"]}            | ${{ days: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T01:00:00+00:00[UTC]"}     | ${["hours"]}           | ${{ hours: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T00:01:00+00:00[UTC]"}     | ${["minutes"]}         | ${{ minutes: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T00:00:01+00:00[UTC]"}     | ${["seconds"]}         | ${{ seconds: 1 }}
    ${"2028-01-01T00:00:00.000+00:00[UTC]"} | ${"2028-01-01T00:00:00.001+00:00[UTC]"} | ${["milliseconds"]}    | ${{ milliseconds: 1 }}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2029-01-01T00:00:00+00:00[UTC]"}     | ${["years", "months"]} | ${{ years: 1, months: 0 }}
  `(
    "returns $expected for $units difference between $value1 and $value2",
    ({ value1, value2, units, expected }) => {
      expect(diffZoned(value1, value2, units)).toEqual(expected);
    },
  );

  it.each`
    value1                                       | value2
    ${"2028-01-01T00:00:00+00:00[UTC]"}          | ${"2028-01-02T00:00:00+00:00[UTC]"}
    ${"2028-01-01T00:00:00+00:00[UTC]"}          | ${"2028-01-02T13:00:00+13:00[Pacific/Apia]"}
    ${"2028-01-01T13:00:00+13:00[Pacific/Apia]"} | ${"2028-01-02T00:00:00+00:00[UTC]"}
    ${"2028-01-01T00:00:00+00:00[UTC]"}          | ${"2028-01-01T13:00:00-11:00[Pacific/Niue]"}
    ${"2027-12-31T13:00:00-11:00[Pacific/Niue]"} | ${"2028-01-02T00:00:00+00:00[UTC]"}
    ${"2028-01-01T13:00:00+13:00[Pacific/Apia]"} | ${"2028-01-01T13:00:00-11:00[Pacific/Niue]"}
    ${"2027-12-31T13:00:00-11:00[Pacific/Niue]"} | ${"2028-01-02T13:00:00+13:00[Pacific/Apia]"}
  `(
    "supports multi timeZone diffs for $value1 and $value2, expecting 1 day difference",
    ({ value1, value2 }) => {
      expect(diffZoned(value1, value2, ["days"])).toEqual({ days: 1 });
    },
  );

  // Leap-year coverage: ensure day-based diffs account for Feb 29.
  it.each`
    value1                              | value2                              | units        | expected
    ${"2024-02-28T00:00:00+00:00[UTC]"} | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${["days"]}  | ${{ days: 2 }}
    ${"2023-02-28T00:00:00+00:00[UTC]"} | ${"2023-03-01T00:00:00+00:00[UTC]"} | ${["days"]}  | ${{ days: 1 }}
    ${"2020-02-29T00:00:00+00:00[UTC]"} | ${"2021-03-01T00:00:00+00:00[UTC]"} | ${["years"]} | ${{ years: 1 }}
  `(
    "handles leap-year boundaries for $value1 -> $value2",
    ({ value1, value2, units, expected }) => {
      expect(diffZoned(value1, value2, units)).toEqual(expected);
    },
  );

  // Error and invalid-input cases: return null when inputs or units are invalid
  it.each`
    value1                              | value2                              | units
    ${"invalid"}                        | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${["days"]}
    ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"invalid"}                        | ${["days"]}
    ${""}                               | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${["days"]}
    ${null}                             | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${["days"]}
  `(
    "returns null for invalid inputs: $value1 | $value2 | $units",
    ({ value1, value2, units }) => {
      expect(diffZoned(value1 as never, value2 as never, units as never)).toBe(
        null,
      );
    },
  );
});
