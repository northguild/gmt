/**
 * The shared non-string fixtures (./nonStrings.ts) and the type-test pattern every overloaded
 * string validator copies.
 *
 * `isDigits` below is a stand-in with the same three overloads a validator gets: a `string` or
 * any other typed argument gets a plain boolean, and only an `unknown` argument narrows to
 * `string`. Copy the `describe("types")` block into the function's own test file and swap in the
 * function and a valid sample.
 */
import { arrives, NON_STRINGS } from "./nonStrings";

function isDigits(value: string): boolean;
function isDigits(value: {} | null | undefined | void): boolean;
function isDigits(value: unknown): value is string;
function isDigits(value: unknown): boolean {
  return typeof value === "string" && /^\d+$/.test(value);
}

describe("NON_STRINGS", () => {
  it("holds a row for each kind of non-string, with names no other row shares", () => {
    const names = NON_STRINGS.map(([kind]) => kind);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining(["a String object", "a Date", "a revoked Proxy"]),
    );
  });

  it("holds only values that are not strings", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(typeof make(), kind).not.toBe("string");
    }
  });

  it("rejects each non-string without a cast", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isDigits(make()), kind).toBe(false);
    }
  });
});

describe("arrives", () => {
  it("returns the value it was given", () => {
    const value = { a: 1 };
    expect(arrives(value)).toBe(value);
  });
});

describe("types", () => {
  it("narrows a value typed unknown to string when it is valid", () => {
    const input = arrives("2024");
    if (isDigits(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    } else {
      expectTypeOf(input).toEqualTypeOf<unknown>();
    }
    expect(isDigits(input)).toBe(true);
  });

  it("keeps a string a string when it is not valid", () => {
    const input: string = "20x4";
    if (!isDigits(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isDigits(input)).toBe(false);
  });

  // A predicate on `string | null` would type an invalid string as `null` on a false result, so
  // a typed union gets a plain boolean and narrows on neither branch.
  it("leaves string | null as it is on both branches", () => {
    const check = (input: string | null): boolean => {
      if (isDigits(input)) {
        expectTypeOf(input).toEqualTypeOf<string | null>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | null>();
      return false;
    };
    expect(check("2024")).toBe(true);
    expect(check(null)).toBe(false);
  });

  it("leaves string | void as it is on both branches", () => {
    const check = (input: string | void): boolean => {
      if (isDigits(input)) {
        expectTypeOf(input).toEqualTypeOf<string | void>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | void>();
      return false;
    };
    expect(check("2024")).toBe(true);
    expect(check(undefined)).toBe(false);
  });

  it("filters an unknown[] to string[]", () => {
    const values = [null, "2024", 1, "nope"].map(arrives);
    const kept = values.filter(isDigits);
    expectTypeOf(kept).toEqualTypeOf<string[]>();
    expect(kept).toEqual(["2024"]);
  });
});
