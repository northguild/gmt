import { getLargestTimeDurationUnit } from "./getLargestTimeDurationUnit";

describe("getLargestTimeDurationUnit", () => {
  it.each`
    units                               | expected
    ${["seconds", "minutes", "hours"]}  | ${"hours"}
    ${["milliseconds", "seconds"]}      | ${"seconds"}
    ${["microseconds", "milliseconds"]} | ${"milliseconds"}
    ${[]}                               | ${"seconds"}
  `("returns $expected for units $units", ({ units, expected }) => {
    expect(getLargestTimeDurationUnit(units)).toBe(expected);
  });

  // Not an array: the documented "no valid unit" default, never a throw (a string is not
  // searched as a substring).
  it.each`
    units
    ${null}
    ${undefined}
    ${"minutes"}
    ${{}}
    ${0}
  `("returns seconds for non-array units $units", ({ units }) => {
    expect(getLargestTimeDurationUnit(units)).toBe("seconds");
  });
});
