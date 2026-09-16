import { getLargestDateDurationUnit } from "./getLargestDateDurationUnit";

describe("getLargestDateDurationUnit", () => {
  it.each`
    units                          | expected
    ${["days", "months", "years"]} | ${"years"}
    ${["weeks", "days"]}           | ${"weeks"}
    ${["months", "days"]}          | ${"months"}
    ${[]}                          | ${"days"}
  `("returns $expected for units $units", ({ units, expected }) => {
    expect(getLargestDateDurationUnit(units)).toBe(expected);
  });

  // Not an array: the documented "no valid unit" default, never a throw (a string is not
  // searched as a substring).
  it.each`
    units
    ${null}
    ${undefined}
    ${"months"}
    ${{}}
    ${0}
  `("returns days for non-array units $units", ({ units }) => {
    expect(getLargestDateDurationUnit(units)).toBe("days");
  });
});
