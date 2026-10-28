import { Temporal } from "../../internal/temporal";

import { areMonthDaysEqual } from "./areMonthDaysEqual";
import { compareMonthDays } from "./compareMonthDays";

const ordered = [
  "--01-01",
  "--01-31",
  "--02-01",
  "--02-28",
  "--02-29",
  "--03-01",
  "--04-30",
  "--06-15",
  "--09-30",
  "--11-30",
  "--12-01",
  "--12-31",
];

const pairs = ordered.flatMap((a, i) =>
  ordered.map((b, j) => ({ a, b, expected: Math.sign(i - j) })),
);

describe("compareMonthDays", () => {
  it.each`
    a                          | b            | expected | why
    ${"--12-25"}               | ${"--12-25"} | ${0}     | ${"same value"}
    ${"12-25"}                 | ${"--12-25"} | ${0}     | ${"input forms"}
    ${"--12-25[u-ca=ISO8601]"} | ${"--12-25"} | ${0}     | ${"D20 upper-case calendar"}
    ${"--12-25[Europe/Paris]"} | ${"--12-25"} | ${0}     | ${"zone annotation ignored"}
    ${"--01-01"}               | ${"--12-31"} | ${-1}    | ${"month first"}
    ${"--12-31"}               | ${"--01-01"} | ${1}     | ${"month first, reversed"}
    ${"--03-01"}               | ${"--03-02"} | ${-1}    | ${"then day"}
    ${"--02-28"}               | ${"--02-29"} | ${-1}    | ${"1972 keeps 29 February"}
    ${"--02-29"}               | ${"--03-01"} | ${-1}    | ${"29 February before 1 March"}
    ${"--02-29"}               | ${"--02-29"} | ${0}     | ${"29 February equals itself"}
    ${"--11-30"}               | ${"--12-01"} | ${-1}    | ${"month boundary"}
  `("returns $expected for '$a' vs '$b' ($why)", ({ a, b, expected }) => {
    expect(compareMonthDays(a, b)).toBe(expected);
  });

  it.each`
    a            | b                          | why
    ${"--02-30"} | ${"--03-01"}               | ${"invalid day"}
    ${"--12-25"} | ${"2024-12-25"}            | ${"a date is not a month-day"}
    ${"--12-25"} | ${"--12-25[u-ca=gregory]"} | ${"not ISO"}
    ${"--1225"}  | ${"--12-25"}               | ${"missing dash"}
    ${""}        | ${"--12-25"}               | ${"empty first"}
    ${"--12-25"} | ${""}                      | ${"empty second"}
    ${null}      | ${"--12-25"}               | ${"null first"}
    ${"--12-25"} | ${null}                    | ${"null second"}
    ${1225}      | ${"--12-25"}               | ${"number first"}
  `("returns null ($why)", ({ a, b }) => {
    expect(compareMonthDays(a as never, b as never)).toBeNull();
  });

  it("returns null when the Temporal comparison throws", () => {
    const spy = vi
      .spyOn(Temporal.PlainDate, "compare")
      .mockImplementation(() => {
        throw new Error("simulated failure");
      });
    try {
      expect(compareMonthDays("--12-25", "--12-26")).toBeNull();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  describe("properties over every ordered pair", () => {
    it.each(pairs)("antisymmetry for '$a' and '$b'", ({ a, b }) => {
      expect(
        (compareMonthDays(a, b) as number) + (compareMonthDays(b, a) as number),
      ).toBe(0);
    });

    it.each(pairs)(
      "agrees with list order for '$a' vs '$b'",
      ({ a, b, expected }) => {
        expect(compareMonthDays(a, b)).toBe(expected);
      },
    );

    it.each(pairs)(
      "is zero exactly when equal for '$a' vs '$b'",
      ({ a, b }) => {
        expect(compareMonthDays(a, b) === 0).toBe(areMonthDaysEqual(a, b));
      },
    );
  });

  it("sorts with null mapped to 0", () => {
    expect(
      ["--12-25", "--02-29", "--01-01", "--03-01", "--02-28"].sort(
        (a, b) => compareMonthDays(a, b) ?? 0,
      ),
    ).toEqual(["--01-01", "--02-28", "--02-29", "--03-01", "--12-25"]);
  });
});
