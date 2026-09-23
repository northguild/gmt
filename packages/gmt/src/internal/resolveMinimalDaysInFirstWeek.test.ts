import { resolveMinimalDaysInFirstWeek } from "./resolveMinimalDaysInFirstWeek";

describe("resolveMinimalDaysInFirstWeek", () => {
  it("defaults to the ISO 8601 value 4 when no minimalDays is given", () => {
    expect(resolveMinimalDaysInFirstWeek()).toBe(4);
    expect(resolveMinimalDaysInFirstWeek({})).toBe(4);
  });

  it.each`
    minimalDays
    ${1}
    ${4}
    ${7}
  `("accepts minimalDays $minimalDays", ({ minimalDays }) => {
    expect(resolveMinimalDaysInFirstWeek({ minimalDays })).toBe(minimalDays);
  });

  it.each`
    minimalDays
    ${0}
    ${8}
    ${-1}
    ${1.5}
    ${Number.NaN}
    ${Number.POSITIVE_INFINITY}
    ${"1"}
    ${null}
  `("returns null for minimalDays $minimalDays", ({ minimalDays }) => {
    expect(resolveMinimalDaysInFirstWeek({ minimalDays })).toBeNull();
  });
});
