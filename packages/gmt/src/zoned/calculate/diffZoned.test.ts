import { diffZoned } from "./diffZoned";

describe("diffZonedDateTime", () => {
  it.each`
    value1                                  | value2                                  | unit             | expected
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2029-01-01T00:00:00+00:00[UTC]"}     | ${"year"}        | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-02-01T00:00:00+00:00[UTC]"}     | ${"month"}       | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-08T00:00:00+00:00[UTC]"}     | ${"week"}        | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-02T00:00:00+00:00[UTC]"}     | ${"day"}         | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T01:00:00+00:00[UTC]"}     | ${"hour"}        | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T00:01:00+00:00[UTC]"}     | ${"minute"}      | ${1}
    ${"2028-01-01T00:00:00+00:00[UTC]"}     | ${"2028-01-01T00:00:01+00:00[UTC]"}     | ${"second"}      | ${1}
    ${"2028-01-01T00:00:00.000+00:00[UTC]"} | ${"2028-01-01T00:00:00.001+00:00[UTC]"} | ${"millisecond"} | ${1}
  `(
    "returns$expected for $unit difference between $value1 and $value2",
    ({ value1, value2, unit, expected }) => {
      expect(diffZoned(value1, value2, unit)).toBe(expected);
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
    "supports multi timezone diffs for $value1 and $value2, expecting 1 day difference",
    ({ value1, value2 }) => {
      expect(diffZoned(value1, value2, "day")).toBe(1);
    },
  );

  // Leap-year coverage: ensure day-based diffs account for Feb 29.
  it.each`
    value1                              | value2                              | unit      | expected
    ${"2024-02-28T00:00:00+00:00[UTC]"} | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"day"}  | ${2}
    ${"2023-02-28T00:00:00+00:00[UTC]"} | ${"2023-03-01T00:00:00+00:00[UTC]"} | ${"day"}  | ${1}
    ${"2020-02-29T00:00:00+00:00[UTC]"} | ${"2021-03-01T00:00:00+00:00[UTC]"} | ${"year"} | ${1}
  `(
    "handles leap-year boundaries for $value1 -> $value2",
    ({ value1, value2, unit, expected }) => {
      expect(diffZoned(value1, value2, unit)).toBe(expected);
    },
  );

  // Error and invalid-input cases: return null when inputs or units are invalid
  it.each`
    value1                              | value2                              | unit
    ${"invalid"}                        | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"day"}
    ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"day"}
    ${""}                               | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"day"}
    ${null}                             | ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"day"}
  `(
    "returns null for invalid inputs: $value1 | $value2 | $unit",
    ({ value1, value2, unit }) => {
      expect(diffZoned(value1 as never, value2 as never, unit as never)).toBe(
        null,
      );
    },
  );
});
