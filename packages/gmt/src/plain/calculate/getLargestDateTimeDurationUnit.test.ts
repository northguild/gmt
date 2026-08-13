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
});
