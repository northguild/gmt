import { Temporal } from "../../internal/temporal";

import { areYearMonthsEqual } from "./areYearMonthsEqual";
import { compareYearMonths } from "./compareYearMonths";

const ordered = [
  "-271821-04",
  "-000001-12",
  "0000-01",
  "0000-12",
  "1999-12",
  "2000-01",
  "2026-01",
  "2026-10",
  "2026-12",
  "9999-12",
  "+010000-01",
  "+275760-09",
];

const pairs = ordered.flatMap((a, i) =>
  ordered.map((b, j) => ({ a, b, expected: Math.sign(i - j) })),
);

describe("compareYearMonths", () => {
  it.each`
    a                          | b               | expected | why
    ${"2026-10"}               | ${"2026-10"}    | ${0}     | ${"same value"}
    ${"+002026-10"}            | ${"2026-10"}    | ${0}     | ${"six-digit form"}
    ${"2026-10[u-ca=ISO8601]"} | ${"2026-10"}    | ${0}     | ${"D20 upper-case calendar"}
    ${"2026-10[Europe/Paris]"} | ${"2026-10"}    | ${0}     | ${"zone annotation ignored"}
    ${"2026-09"}               | ${"2026-10"}    | ${-1}    | ${"month"}
    ${"2026-10"}               | ${"2026-09"}    | ${1}     | ${"month, reversed"}
    ${"2025-12"}               | ${"2026-01"}    | ${-1}    | ${"year boundary"}
    ${"2027-01"}               | ${"2026-12"}    | ${1}     | ${"year first, then month"}
    ${"-000001-12"}            | ${"0000-01"}    | ${-1}    | ${"negative year before year 0"}
    ${"-271821-04"}            | ${"+275760-09"} | ${-1}    | ${"the limits"}
    ${"+275760-09"}            | ${"+275760-09"} | ${0}     | ${"upper limit equals itself"}
    ${"-271821-04"}            | ${"-271821-04"} | ${0}     | ${"lower limit equals itself"}
    ${"2024-02"}               | ${"2024-03"}    | ${-1}    | ${"leap February before March"}
  `("returns $expected for '$a' vs '$b' ($why)", ({ a, b, expected }) => {
    expect(compareYearMonths(a, b)).toBe(expected);
  });

  it.each`
    a               | b                          | why
    ${"2026-13"}    | ${"2026-10"}               | ${"invalid month"}
    ${"2026-10"}    | ${"2026-10-01"}            | ${"a date is not a year-month"}
    ${"2026-10"}    | ${"2026-10[u-ca=gregory]"} | ${"not ISO"}
    ${"202610"}     | ${"2026-10"}               | ${"basic form"}
    ${""}           | ${"2026-10"}               | ${"empty first"}
    ${"2026-10"}    | ${""}                      | ${"empty second"}
    ${null}         | ${"2026-10"}               | ${"null first"}
    ${"2026-10"}    | ${null}                    | ${"null second"}
    ${202610}       | ${"2026-10"}               | ${"number first"}
    ${"2026-10"}    | ${202610}                  | ${"number second"}
    ${{}}           | ${"2026-10"}               | ${"object first"}
    ${"2026-13"}    | ${"2026-13"}               | ${"invalid on both sides"}
    ${"+275760-10"} | ${"2026-10"}               | ${"one month past the upper limit"}
    ${"-271821-03"} | ${"2026-10"}               | ${"one month before the lower limit"}
    ${"-000000-01"} | ${"2026-10"}               | ${"negative zero year"}
  `("returns null ($why)", ({ a, b }) => {
    expect(compareYearMonths(a as never, b as never)).toBeNull();
  });

  it("returns null when the Temporal comparison throws", () => {
    const spy = vi
      .spyOn(Temporal.PlainYearMonth, "compare")
      .mockImplementation(() => {
        throw new Error("simulated failure");
      });
    try {
      expect(compareYearMonths("2026-10", "2026-11")).toBeNull();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  describe("properties over every ordered pair", () => {
    it.each(pairs)("antisymmetry for '$a' and '$b'", ({ a, b }) => {
      expect(
        (compareYearMonths(a, b) as number) +
          (compareYearMonths(b, a) as number),
      ).toBe(0);
    });

    it.each(pairs)(
      "agrees with list order for '$a' vs '$b'",
      ({ a, b, expected }) => {
        expect(compareYearMonths(a, b)).toBe(expected);
      },
    );

    it.each(pairs)(
      "is zero exactly when equal for '$a' vs '$b'",
      ({ a, b }) => {
        expect(compareYearMonths(a, b) === 0).toBe(areYearMonthsEqual(a, b));
      },
    );
  });

  it("sorts with null mapped to 0", () => {
    expect(
      ["2026-10", "-000001-12", "2026-01", "0000-01", "2025-12"].sort(
        (a, b) => compareYearMonths(a, b) ?? 0,
      ),
    ).toEqual(["-000001-12", "0000-01", "2025-12", "2026-01", "2026-10"]);
  });
});
