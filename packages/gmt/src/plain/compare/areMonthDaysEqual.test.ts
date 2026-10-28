import { Temporal } from "../../internal/temporal";

import { areMonthDaysEqual } from "./areMonthDaysEqual";

describe("areMonthDaysEqual", () => {
  it.each`
    a                          | b                          | why
    ${"--12-25"}               | ${"--12-25"}               | ${"same value"}
    ${"12-25"}                 | ${"--12-25"}               | ${"input forms"}
    ${"--12-25[u-ca=iso8601]"} | ${"--12-25[u-ca=ISO8601]"} | ${"D20 calendar case"}
    ${"--12-25[_foo=bar]"}     | ${"--12-25"}               | ${"elective annotation ignored"}
    ${"--02-29"}               | ${"--02-29"}               | ${"29 February equals itself"}
    ${"--12-25[Europe/Paris]"} | ${"12-25"}                 | ${"zone annotation ignored"}
  `("returns true for '$a' and '$b' ($why)", ({ a, b }) => {
    expect(areMonthDaysEqual(a, b)).toBe(true);
  });

  it.each`
    a            | b                          | why
    ${"--02-29"} | ${"--02-28"}               | ${"not constrained"}
    ${"--12-25"} | ${"--12-26"}               | ${"day differs"}
    ${"--12-25"} | ${"--11-25"}               | ${"month differs"}
    ${"--02-30"} | ${"--02-30"}               | ${"invalid on both sides"}
    ${"--12-25"} | ${"2024-12-25"}            | ${"a date is not a month-day"}
    ${"--12-25"} | ${"--12-25[u-ca=gregory]"} | ${"not ISO"}
    ${""}        | ${"--12-25"}               | ${"empty"}
    ${null}      | ${"--12-25"}               | ${"null"}
    ${{}}        | ${"--12-25"}               | ${"object"}
    ${"--12-25"} | ${null}                    | ${"null second"}
    ${1225}      | ${"--12-25"}               | ${"number"}
    ${"--12-25"} | ${""}                      | ${"empty second"}
  `("returns false ($why)", ({ a, b }) => {
    expect(areMonthDaysEqual(a as never, b as never)).toBe(false);
  });

  it("returns false when the Temporal equality check throws", () => {
    const spy = vi
      .spyOn(Temporal.PlainMonthDay.prototype, "equals")
      .mockImplementation(() => {
        throw new Error("simulated failure");
      });
    try {
      expect(areMonthDaysEqual("--12-25", "--12-25")).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
