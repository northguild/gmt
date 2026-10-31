import { formatNanoseconds } from "../format/formatNanoseconds";
import { parseNanoseconds } from "../parse/parseNanoseconds";
import { arrives, NON_STRINGS } from "../../test/nonStrings";
import { isValidNanoPattern } from "./isValidNanoPattern";

describe("isValidNanoPattern", () => {
  it.each`
    value                        | reason
    ${"1710072000123456789"}     | ${"a modern instant"}
    ${"0"}                       | ${"the epoch, where parseNanoseconds returns 0n"}
    ${"-1000000000"}             | ${"pre-epoch"}
    ${"8640000000000000000000"}  | ${"the maximum"}
    ${"-8640000000000000000000"} | ${"the minimum"}
  `("returns true for $value ($reason)", ({ value }) => {
    expect(isValidNanoPattern(value)).toBe(true);
  });

  it.each`
    value                        | reason
    ${"01"}                      | ${"leading zero"}
    ${"+1"}                      | ${"explicit plus sign"}
    ${"1.5"}                     | ${"fraction"}
    ${"1e18"}                    | ${"exponent"}
    ${"0x10"}                    | ${"hex"}
    ${"1_000"}                   | ${"digit separator"}
    ${" 1"}                      | ${"leading whitespace"}
    ${"1 "}                      | ${"trailing whitespace"}
    ${'"123"'}                   | ${"JSON text rather than the string value"}
    ${"8640000000000000000001"}  | ${"one past the maximum"}
    ${"-8640000000000000000001"} | ${"one before the minimum"}
    ${"1".repeat(400)}           | ${"absurdly long, rejected before BigInt"}
    ${"garbage"}                 | ${"not a number"}
    ${""}                        | ${"empty string"}
  `("returns false for '$value' ($reason)", ({ value }) => {
    expect(isValidNanoPattern(value)).toBe(false);
  });

  it('accepts "-0", because parseNanoseconds does — the two must never disagree', () => {
    // Not what formatNanoseconds emits for 0n (that is "0"), but the grammar admits it and
    // BigInt has no negative zero, so it round-trips to the same value. The validator's
    // contract is "accepts exactly what parseNanoseconds parses", not "is canonical".
    expect(isValidNanoPattern("-0")).toBe(true);
    expect(parseNanoseconds("-0")).toBe(0n);
    expect(formatNanoseconds(0n)).toBe("0");
  });

  it("is the predicate that disambiguates parseNanoseconds' 0n", () => {
    expect(isValidNanoPattern("0")).toBe(true);
    expect(parseNanoseconds("0")).toBe(0n);

    expect(isValidNanoPattern("garbage")).toBe(false);
    expect(parseNanoseconds("garbage")).toBe(0n);
  });

  it.each`
    value
    ${0n}
    ${1710072000123456789n}
    ${-1000000000n}
    ${8640000000000000000000n}
  `("accepts everything formatNanoseconds emits, for $value", ({ value }) => {
    const formatted = formatNanoseconds(value);

    expect(isValidNanoPattern(formatted)).toBe(true);
    expect(parseNanoseconds(formatted)).toBe(value);
  });

  // The bigint row (20240615n) is the input a caller is most likely to pass by mistake: the
  // validator asks about the decimal string form, and a bigint is not one.
  it("returns false for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidNanoPattern(make()), kind).toBe(false);
    }
  });

  it("returns true through both overloads for a valid string", () => {
    expect(isValidNanoPattern("1710072000123456789")).toBe(true);
    expect(isValidNanoPattern(arrives("1710072000123456789"))).toBe(true);
  });
});

describe("isValidNanoPattern types", () => {
  it("narrows a value typed unknown to string when it is valid", () => {
    const input = arrives("1710072000123456789");
    if (isValidNanoPattern(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    } else {
      expectTypeOf(input).toEqualTypeOf<unknown>();
    }
    expect(isValidNanoPattern(input)).toBe(true);
  });

  it("keeps a string a string when it is not valid", () => {
    const input: string = "17x";
    if (!isValidNanoPattern(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidNanoPattern(input)).toBe(false);
  });

  // A predicate on `string | null` would type an invalid string as `null` on a false result, so
  // a typed union gets a plain boolean and narrows on neither branch.
  it("leaves string | null as it is on both branches", () => {
    const check = (input: string | null): boolean => {
      if (isValidNanoPattern(input)) {
        expectTypeOf(input).toEqualTypeOf<string | null>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | null>();
      return false;
    };
    expect(check("1710072000123456789")).toBe(true);
    expect(check(null)).toBe(false);
  });

  it("leaves string | void as it is on both branches", () => {
    const check = (input: string | void): boolean => {
      if (isValidNanoPattern(input)) {
        expectTypeOf(input).toEqualTypeOf<string | void>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | void>();
      return false;
    };
    expect(check("1710072000123456789")).toBe(true);
    expect(check(undefined)).toBe(false);
  });

  it("filters an unknown[] to string[]", () => {
    const values = [null, "1710072000123456789", 1, "17x"].map(arrives);
    const kept = values.filter(isValidNanoPattern);
    expectTypeOf(kept).toEqualTypeOf<string[]>();
    expect(kept).toEqual(["1710072000123456789"]);
  });
});
