import { arrives, NON_STRINGS } from "../../test/nonStrings";
import { isValidDuration } from "./isValidDuration";

describe("isValidDuration", () => {
  it.each`
    value                 | expected
    ${"P1D"}              | ${true}
    ${"PT1H"}             | ${true}
    ${"PT1M"}             | ${true}
    ${"PT1S"}             | ${true}
    ${"PT90M"}            | ${true}
    ${"P1DT1H"}           | ${true}
    ${"P1Y"}              | ${true}
    ${"P1M"}              | ${true}
    ${"P1W"}              | ${true}
    ${"P1Y2M3W4DT5H6M7S"} | ${true}
    ${"P1DT2H30M"}        | ${true}
    ${"P1Y2M"}            | ${true}
    ${"PT2H30M"}          | ${true}
  `("returns $expected for valid duration $value", ({ value, expected }) => {
    expect(isValidDuration(value)).toBe(expected);
  });

  it.each`
    value                 | expected
    ${"P0D"}              | ${true}
    ${"PT0S"}             | ${true}
    ${"P0Y0M0W0DT0H0M0S"} | ${true}
  `(
    "returns $expected for zero-value duration $value",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
    },
  );

  it.each`
    value                | expected
    ${"-P1D"}            | ${true}
    ${"-P1Y2M3DT4H5M6S"} | ${true}
    ${"+P1D"}            | ${true}
    ${"P1DT-2H"}         | ${false}
  `("returns $expected for signed duration $value", ({ value, expected }) => {
    expect(isValidDuration(value)).toBe(expected);
  });

  it.each`
    value               | expected
    ${"PT1.5H"}         | ${true}
    ${"PT1.5M"}         | ${true}
    ${"PT1.5S"}         | ${true}
    ${"PT1.123456789S"} | ${true}
  `(
    "returns $expected for fractional smallest-unit duration $value",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
    },
  );

  it.each`
    value           | expected
    ${"P1.5Y"}      | ${false}
    ${"P1.5M"}      | ${false}
    ${"P1.5W"}      | ${false}
    ${"P1.5D"}      | ${false}
    ${"PT1.5H2M"}   | ${false}
    ${"P1DT1.5H2M"} | ${false}
  `(
    "returns $expected for invalid fractional-unit duration $value",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
    },
  );

  it.each`
    value     | expected
    ${"p1d"}  | ${true}
    ${"P1d"}  | ${true}
    ${"p1D"}  | ${true}
    ${"pt1h"} | ${true}
  `(
    "returns $expected for lowercase-designator duration $value",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
    },
  );

  it.each`
    value               | expected
    ${"P1"}             | ${false}
    ${"PT"}             | ${false}
    ${"P1DT"}           | ${false}
    ${"1D"}             | ${false}
    ${"PD"}             | ${false}
    ${"P1D2H"}          | ${false}
    ${"P"}              | ${false}
    ${""}               | ${false}
    ${"not a duration"} | ${false}
  `(
    "returns $expected for malformed duration '$value'",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
    },
  );

  it.each`
    value     | expected
    ${" P1D"} | ${false}
    ${"P1D "} | ${false}
    ${"P 1D"} | ${false}
  `(
    "returns $expected for whitespace-containing duration $value",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
    },
  );

  it.each`
    value                       | expected
    ${"P999999999D"}            | ${true}
    ${"P99999999999999999999D"} | ${false}
  `(
    "returns $expected for extreme-magnitude duration $value",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
    },
  );

  it("returns false for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidDuration(make()), kind).toBe(false);
    }
  });

  it("returns true through both overloads for a valid string", () => {
    expect(isValidDuration("P1DT2H30M")).toBe(true);
    expect(isValidDuration(arrives("P1DT2H30M"))).toBe(true);
  });
});

describe("isValidDuration types", () => {
  it("narrows a value typed unknown to string when it is valid", () => {
    const input = arrives("P1DT2H30M");
    if (isValidDuration(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    } else {
      expectTypeOf(input).toEqualTypeOf<unknown>();
    }
    expect(isValidDuration(input)).toBe(true);
  });

  it("keeps a string a string when it is not valid", () => {
    const input: string = "P1X";
    if (!isValidDuration(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidDuration(input)).toBe(false);
  });

  // A predicate on `string | null` would type an invalid string as `null` on a false result, so
  // a typed union gets a plain boolean and narrows on neither branch.
  it("leaves string | null as it is on both branches", () => {
    const check = (input: string | null): boolean => {
      if (isValidDuration(input)) {
        expectTypeOf(input).toEqualTypeOf<string | null>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | null>();
      return false;
    };
    expect(check("P1DT2H30M")).toBe(true);
    expect(check(null)).toBe(false);
  });

  it("leaves string | void as it is on both branches", () => {
    const check = (input: string | void): boolean => {
      if (isValidDuration(input)) {
        expectTypeOf(input).toEqualTypeOf<string | void>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | void>();
      return false;
    };
    expect(check("P1DT2H30M")).toBe(true);
    expect(check(undefined)).toBe(false);
  });

  it("filters an unknown[] to string[]", () => {
    const values = [null, "P1DT2H30M", 1, "P1X"].map(arrives);
    const kept = values.filter(isValidDuration);
    expectTypeOf(kept).toEqualTypeOf<string[]>();
    expect(kept).toEqual(["P1DT2H30M"]);
  });
});
