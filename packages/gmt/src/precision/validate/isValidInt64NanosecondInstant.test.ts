import { arrives, NON_STRINGS } from "../../test/nonStrings";
import { isValidInt64NanosecondInstant } from "./isValidInt64NanosecondInstant";

describe("isValidInt64NanosecondInstant", () => {
  it.each`
    value                                      | expected | label
    ${"1677-09-21T00:12:43.145224192Z"}        | ${true}  | ${"'1677-09-21T00:12:43.145224192Z'"}
    ${"1677-09-21T00:12:43.145224191Z"}        | ${false} | ${"'1677-09-21T00:12:43.145224191Z'"}
    ${"2262-04-11T23:47:16.854775807Z"}        | ${true}  | ${"'2262-04-11T23:47:16.854775807Z'"}
    ${"2262-04-11T23:47:16.854775808Z"}        | ${false} | ${"'2262-04-11T23:47:16.854775808Z'"}
    ${"1970-01-01T00:00:00Z"}                  | ${true}  | ${"'1970-01-01T00:00:00Z'"}
    ${"2024-01-01T09:00:00+09:00[Asia/Tokyo]"} | ${true}  | ${"'2024-01-01T09:00:00+09:00[Asia/Tokyo]'"}
    ${"+010000-01-01T00:00:00Z"}               | ${false} | ${"'+010000-01-01T00:00:00Z'"}
    ${"-271821-04-20T00:00:00Z"}               | ${false} | ${"'-271821-04-20T00:00:00Z'"}
    ${"2262-04-12T08:47:16.854775807+09:00"}   | ${true}  | ${"'2262-04-12T08:47:16.854775807+09:00'"}
    ${"2262-04-12T08:47:16.854775808+09:00"}   | ${false} | ${"'2262-04-12T08:47:16.854775808+09:00'"}
    ${"2024-01-01T00:00:00"}                   | ${false} | ${"'2024-01-01T00:00:00'"}
    ${"2024-01-01T00:00:00[Asia/Tokyo]"}       | ${false} | ${"'2024-01-01T00:00:00[Asia/Tokyo]'"}
    ${"1677-09-21T00:12:43.145224192"}         | ${false} | ${"'1677-09-21T00:12:43.145224192'"}
    ${"+275760-09-13T00:00:00Z"}               | ${false} | ${"'+275760-09-13T00:00:00Z'"}
    ${"1677-09-21T09:12:43.145224192+09:00"}   | ${true}  | ${"'1677-09-21T09:12:43.145224192+09:00'"}
    ${"1677-09-21T09:12:43.145224191+09:00"}   | ${false} | ${"'1677-09-21T09:12:43.145224191+09:00'"}
    ${"2016-12-31T23:59:60Z"}                  | ${false} | ${"'2016-12-31T23:59:60Z'"}
    ${"invalid"}                               | ${false} | ${"'invalid'"}
    ${""}                                      | ${false} | ${"''"}
  `("returns $expected for $label", ({ value, expected }) => {
    expect(isValidInt64NanosecondInstant(value)).toBe(expected);
  });

  it("returns false for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidInt64NanosecondInstant(make()), kind).toBe(false);
    }
  });

  it("returns true through both overloads for a valid string", () => {
    expect(isValidInt64NanosecondInstant("2024-01-01T00:00:00Z")).toBe(true);
    expect(isValidInt64NanosecondInstant(arrives("2024-01-01T00:00:00Z"))).toBe(
      true,
    );
  });
});

describe("isValidInt64NanosecondInstant types", () => {
  it("narrows a value typed unknown to string when it is valid", () => {
    const input = arrives("2024-01-01T00:00:00Z");
    if (isValidInt64NanosecondInstant(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    } else {
      expectTypeOf(input).toEqualTypeOf<unknown>();
    }
    expect(isValidInt64NanosecondInstant(input)).toBe(true);
  });

  it("keeps a string a string when it is not valid", () => {
    const input: string = "2024-01-01T00:00:00";
    if (!isValidInt64NanosecondInstant(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidInt64NanosecondInstant(input)).toBe(false);
  });

  // A predicate on `string | null` would type an invalid string as `null` on a false result, so
  // a typed union gets a plain boolean and narrows on neither branch.
  it("leaves string | null as it is on both branches", () => {
    const check = (input: string | null): boolean => {
      if (isValidInt64NanosecondInstant(input)) {
        expectTypeOf(input).toEqualTypeOf<string | null>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | null>();
      return false;
    };
    expect(check("2024-01-01T00:00:00Z")).toBe(true);
    expect(check(null)).toBe(false);
  });

  it("leaves string | void as it is on both branches", () => {
    const check = (input: string | void): boolean => {
      if (isValidInt64NanosecondInstant(input)) {
        expectTypeOf(input).toEqualTypeOf<string | void>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | void>();
      return false;
    };
    expect(check("2024-01-01T00:00:00Z")).toBe(true);
    expect(check(undefined)).toBe(false);
  });

  it("filters an unknown[] to string[]", () => {
    const values = [null, "2024-01-01T00:00:00Z", 1, "2024-01-01T00:00:00"].map(
      arrives,
    );
    const kept = values.filter(isValidInt64NanosecondInstant);
    expectTypeOf(kept).toEqualTypeOf<string[]>();
    expect(kept).toEqual(["2024-01-01T00:00:00Z"]);
  });
});
