import { getLargestDateTimeDurationUnit } from "./getLargestDateTimeDurationUnit";

describe("getLargestDateTimeDurationUnit", () => {
  it.each`
    units                               | expected
    ${["seconds", "minutes", "hours"]}  | ${"hours"}
    ${["milliseconds", "seconds"]}      | ${"seconds"}
    ${["microseconds", "milliseconds"]} | ${"milliseconds"}
    ${["days", "months", "years"]}      | ${"years"}
    ${["weeks", "days"]}                | ${"weeks"}
    ${["months", "days"]}               | ${"months"}
    ${[]}                               | ${"seconds"}
  `("returns $expected for units $units", ({ units, expected }) => {
    expect(getLargestDateTimeDurationUnit(units)).toBe(expected);
  });

  // Not an array: the documented "no valid unit" default, never a throw (a string is not
  // searched as a substring).
  it.each`
    units
    ${null}
    ${undefined}
    ${"hours"}
    ${{}}
    ${0}
  `("returns seconds for non-array units $units", ({ units }) => {
    expect(getLargestDateTimeDurationUnit(units)).toBe("seconds");
  });
});
