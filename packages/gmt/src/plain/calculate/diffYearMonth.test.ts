import { addYearMonth } from "./addYearMonth";
import { diffYearMonth } from "./diffYearMonth";
import { compareYearMonths } from "../compare/compareYearMonths";

describe("diffYearMonth", () => {
  it.each`
    a                             | b                             | unit        | expected
    ${"2025-11"}                  | ${"2026-10"}                  | ${"months"} | ${11}
    ${"2025-11"}                  | ${"2026-10"}                  | ${"month"}  | ${11}
    ${"2026-10"}                  | ${"2025-11"}                  | ${"months"} | ${-11}
    ${"2025-11"}                  | ${"2027-10"}                  | ${"years"}  | ${1}
    ${"2025-11"}                  | ${"2027-10"}                  | ${"year"}   | ${1}
    ${"2027-10"}                  | ${"2025-11"}                  | ${"years"}  | ${-1}
    ${"2024-01"}                  | ${"2026-12"}                  | ${"years"}  | ${2}
    ${"2026-03"}                  | ${"2026-10"}                  | ${"years"}  | ${0}
    ${"2026-10"}                  | ${"2026-10"}                  | ${"months"} | ${0}
    ${"-271821-05"}               | ${"+275760-09"}               | ${"months"} | ${6570976}
    ${"-271821-04"}               | ${"-271821-04"}               | ${"months"} | ${0}
    ${"+002026-10[u-ca=ISO8601]"} | ${"2026-10"}                  | ${"months"} | ${0}
    ${"2026-10"}                  | ${"+002026-10[u-ca=ISO8601]"} | ${"years"}  | ${0}
    ${"+002026-10[u-ca=ISO8601]"} | ${"2026-12"}                  | ${"months"} | ${2}
  `(
    "returns $expected for diffYearMonth('$a', '$b', '$unit')",
    ({ a, b, unit, expected }) => {
      expect(diffYearMonth(a, b, unit)).toBe(expected);
    },
  );

  it("returns +0, not -0, for a negative difference under one year", () => {
    expect(Object.is(diffYearMonth("2026-10", "2026-03", "years"), 0)).toBe(
      true,
    );
  });

  it.each`
    a               | b               | unit        | label
    ${"-271821-05"} | ${"+275760-09"} | ${"years"}  | ${"whole range by years (rounding step leaves the range)"}
    ${"2026-09"}    | ${"+275760-09"} | ${"years"}  | ${"next whole year passes the highest year-month"}
    ${"2026-10"}    | ${"-271821-05"} | ${"years"}  | ${"next whole year passes the lowest year-month"}
    ${"-271821-04"} | ${"+275760-09"} | ${"months"} | ${"lowest year-month with a different one (day 1 out of range)"}
    ${"2026-10"}    | ${"2026-11"}    | ${"days"}   | ${"days"}
    ${"2026-10"}    | ${"2026-11"}    | ${"weeks"}  | ${"weeks"}
    ${"2026-10"}    | ${"2026-11"}    | ${"Months"} | ${"wrong case"}
    ${"2026-10"}    | ${"2026-11"}    | ${""}       | ${"empty unit"}
    ${"2026-10"}    | ${"2026-11"}    | ${null}     | ${"null unit"}
    ${"2026-10"}    | ${"2026-10-01"} | ${"months"} | ${"b is a date"}
    ${"2026-10-01"} | ${"2026-10"}    | ${"months"} | ${"a is a date"}
    ${"2026-13"}    | ${"2026-10"}    | ${"months"} | ${"a month 13"}
  `("returns null for diffYearMonth: $label", ({ a, b, unit }) => {
    expect(diffYearMonth(a, b, unit)).toBeNull();
  });

  it.each`
    a               | b
    ${"-271821-05"} | ${"+275760-09"}
    ${"+275760-09"} | ${"-271821-05"}
    ${"-000001-12"} | ${"0000-01"}
    ${"0000-01"}    | ${"-000001-12"}
    ${"1999-12"}    | ${"2024-02"}
    ${"2024-02"}    | ${"1999-12"}
    ${"2026-10"}    | ${"2027-01"}
    ${"2027-01"}    | ${"2026-10"}
    ${"2026-10"}    | ${"2026-10"}
    ${"-271821-05"} | ${"-271821-05"}
  `("antisymmetry and add round trip hold for '$a' and '$b'", ({ a, b }) => {
    const forward = diffYearMonth(a, b, "months");
    const back = diffYearMonth(b, a, "months");
    expect(forward).not.toBeNull();
    expect((forward as number) + (back as number)).toBe(0);
    expect(addYearMonth(a, { months: forward as number })).toBe(
      addYearMonth(b, { months: 0 }),
    );
  });

  it.each`
    a               | b
    ${"-271821-05"} | ${"+275760-04"}
    ${"-000001-12"} | ${"0000-01"}
    ${"1999-12"}    | ${"2024-02"}
    ${"2026-10"}    | ${"2027-01"}
    ${"2026-10"}    | ${"2026-10"}
    ${"2026-10"}    | ${"+002026-10[u-ca=ISO8601]"}
  `(
    "the sign of diffYearMonth('$a', '$b') is the opposite of compareYearMonths",
    ({ a, b }) => {
      const order = compareYearMonths(a, b) as number;
      for (const unit of ["months", "years"] as const) {
        const diff = diffYearMonth(a, b, unit) as number;
        // Whole years truncate, so a year diff may be 0 where compare is not.
        if (unit === "months" || diff !== 0) {
          expect(Math.sign(diff)).toBe(0 - order);
        }
      }
    },
  );
});
