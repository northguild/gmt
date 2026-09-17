import { getLargestDateDurationUnit } from "./getLargestDateDurationUnit";

describe("getLargestDateDurationUnit", () => {
  it.each`
    units                          | expected
    ${["days", "months", "years"]} | ${"years"}
    ${["weeks", "days"]}           | ${"weeks"}
    ${["months", "days"]}          | ${"months"}
  `("returns $expected for units $units", ({ units, expected }) => {
    expect(getLargestDateDurationUnit(units)).toBe(expected);
  });

  // Temporal §13.17: a singular unit name is the same unit as its plural; the result is the plural name.
  it.each`
    units               | expected
    ${["day", "month"]} | ${"months"}
    ${["week"]}         | ${"weeks"}
  `("returns $expected for units $units", ({ units, expected }) => {
    expect(getLargestDateDurationUnit(units)).toBe(expected);
  });

  // An empty list, a non-array, or a list holding anything but a duration unit is invalid input, so the
  // result is the string sentinel. Singular names count as their plural (Temporal §13.17).
  it.each`
    units
    ${[]}
    ${null}
    ${undefined}
    ${"days"}
    ${{}}
    ${0}
    ${["days", "bananas"]}
    ${["fortnights"]}
    ${[1]}
  `("returns an empty string for invalid units $units", ({ units }) => {
    expect(getLargestDateDurationUnit(units)).toBe("");
  });
});
