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
});
