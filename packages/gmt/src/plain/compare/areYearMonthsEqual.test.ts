import { Temporal } from "../../internal/temporal";

import { areYearMonthsEqual } from "./areYearMonthsEqual";

describe("areYearMonthsEqual", () => {
  it.each`
    a                          | b                           | why
    ${"2026-10"}               | ${"2026-10"}                | ${"same value"}
    ${"+002026-10"}            | ${"2026-10"}                | ${"six-digit form"}
    ${"2026-10[u-ca=iso8601]"} | ${"2026-10[!u-ca=Iso8601]"} | ${"D20 calendar case"}
    ${"2026-10[_foo=bar]"}     | ${"2026-10"}                | ${"elective annotation ignored"}
  `("returns true for '$a' and '$b' ($why)", ({ a, b }) => {
    expect(areYearMonthsEqual(a, b)).toBe(true);
  });

  it.each`
    a               | b                         | why
    ${"2026-10"}    | ${"2025-10"}              | ${"same month, other year"}
    ${"2026-10"}    | ${"2026-11"}              | ${"month differs"}
    ${"0000-10"}    | ${"-000001-10"}           | ${"year 0 against year -1"}
    ${"2026-10"}    | ${"2026-10-01"}           | ${"a date"}
    ${"2026-13"}    | ${"2026-10"}              | ${"invalid month"}
    ${""}           | ${"2026-10"}              | ${"empty"}
    ${null}         | ${"2026-10"}              | ${"null"}
    ${"2026-10"}    | ${null}                   | ${"null second"}
    ${202610}       | ${"2026-10"}              | ${"number"}
    ${"2026-10"}    | ${"2026-10[u-ca=hebrew]"} | ${"not ISO"}
    ${"2026-13"}    | ${"2026-13"}              | ${"invalid on both sides"}
    ${{}}           | ${"2026-10"}              | ${"object"}
    ${"2026-10"}    | ${""}                     | ${"empty second"}
    ${"+275760-10"} | ${"+275760-10"}           | ${"past the upper limit on both sides"}
  `("returns false ($why)", ({ a, b }) => {
    expect(areYearMonthsEqual(a as never, b as never)).toBe(false);
  });

  it("returns false when the Temporal equality check throws", () => {
    const spy = vi
      .spyOn(Temporal.PlainYearMonth.prototype, "equals")
      .mockImplementation(() => {
        throw new Error("simulated failure");
      });
    try {
      expect(areYearMonthsEqual("2026-10", "2026-10")).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
