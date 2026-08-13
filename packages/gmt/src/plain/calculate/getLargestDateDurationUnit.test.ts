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
});
