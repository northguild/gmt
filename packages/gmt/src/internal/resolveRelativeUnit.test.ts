import { describe, expect, it } from "vitest";
import { resolveRelativeUnit } from "./resolveRelativeUnit";

const TIME_UNITS = ["hour", "minute", "second"] as const;

describe("resolveRelativeUnit", () => {
  // Temporal GetTemporalUnitValuedOption: a plural unit name is its singular.
  it.each`
    largestUnit  | expected
    ${"hour"}    | ${"hour"}
    ${"hours"}   | ${"hour"}
    ${"minute"}  | ${"minute"}
    ${"minutes"} | ${"minute"}
    ${"second"}  | ${"second"}
    ${"seconds"} | ${"second"}
  `(
    "returns $expected for the allowed unit $largestUnit",
    ({ largestUnit, expected }) => {
      expect(resolveRelativeUnit(largestUnit, TIME_UNITS)).toBe(expected);
    },
  );

  // GetOption: undefined is the omitted option, so there is no unit to resolve.
  it("returns undefined for an omitted largestUnit", () => {
    expect(resolveRelativeUnit(undefined, TIME_UNITS)).toBeUndefined();
  });

  // Temporal ValidateTemporalUnitValue throws RangeError for a unit outside the unit group; a
  // value that is not a lower-case unit name is not a unit at all.
  it.each`
    label                           | largestUnit                   | why
    ${"day"}                        | ${"day"}                      | ${"outside the allowed units"}
    ${"days"}                       | ${"days"}                     | ${"outside the allowed units"}
    ${"quarter"}                    | ${"quarter"}                  | ${"not a relative unit here"}
    ${"HOUR"}                       | ${"HOUR"}                     | ${"unit names are lower case"}
    ${"hourss"}                     | ${"hourss"}                   | ${"only one plural s"}
    ${"s"}                          | ${"s"}                        | ${"the plural s alone"}
    ${'""'}                         | ${""}                         | ${"an empty string"}
    ${"null"}                       | ${null}                       | ${"null is a value"}
    ${"1"}                          | ${1}                          | ${"a number"}
    ${'["hour"]'}                   | ${["hour"]}                   | ${"an array, not a string"}
    ${'{ toString: () => "hour" }'} | ${{ toString: () => "hour" }} | ${"an object, not a string"}
    ${"Symbol()"}                   | ${Symbol("hour")}             | ${"a symbol"}
  `("throws RangeError for largestUnit $label ($why)", ({ largestUnit }) => {
    expect(() => resolveRelativeUnit(largestUnit, TIME_UNITS)).toThrow(
      RangeError,
    );
  });
});
