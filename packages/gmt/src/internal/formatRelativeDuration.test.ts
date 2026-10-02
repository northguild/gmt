import { describe, expect, it } from "vitest";
import { formatRelativeAmount } from "./formatRelativeDuration";

describe("formatRelativeAmount", () => {
  // The rounding applies to the signed value: -1.5 floors to -2, and rounds (half toward positive
  // infinity) to -1. en-US writes 1 day as "tomorrow" with numeric "auto" and "in 1 day" with
  // "always"; the short style of "hour" is "hr."
  it.each`
    total   | unit      | options                  | roundingMethod | expected
    ${-1.5} | ${"hour"} | ${{}}                    | ${"floor"}     | ${"2 hours ago"}
    ${-1.5} | ${"hour"} | ${{}}                    | ${undefined}   | ${"1 hour ago"}
    ${1}    | ${"day"}  | ${{}}                    | ${undefined}   | ${"tomorrow"}
    ${1}    | ${"day"}  | ${{ numeric: "always" }} | ${undefined}   | ${"in 1 day"}
    ${3}    | ${"hour"} | ${{ style: "short" }}    | ${undefined}   | ${"in 3 hr."}
    ${3}    | ${"hour"} | ${{ style: undefined }}  | ${undefined}   | ${"in 3 hours"}
  `(
    "returns $expected for $total $unit with options $options and roundingMethod $roundingMethod",
    ({ total, unit, options, roundingMethod, expected }) => {
      expect(
        formatRelativeAmount(total, unit, "en-US", options, roundingMethod),
      ).toBe(expected);
    },
  );

  // Intl.RelativeTimeFormat throws RangeError for a style or numeric outside its lists, and
  // resolveRelativeRounding for a method outside its three.
  it.each`
    label                        | options                 | roundingMethod
    ${'style: "wide"'}           | ${{ style: "wide" }}    | ${undefined}
    ${'numeric: "never"'}        | ${{ numeric: "never" }} | ${undefined}
    ${'roundingMethod: "trunc"'} | ${{}}                   | ${"trunc"}
  `("throws RangeError for $label", ({ options, roundingMethod }) => {
    expect(() =>
      formatRelativeAmount(1, "day", "en-US", options, roundingMethod),
    ).toThrow(RangeError);
  });
});
