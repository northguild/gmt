import { arrives, NON_STRINGS } from "../../test/nonStrings";
import { isValidInt64NanosecondDateTime } from "./isValidInt64NanosecondDateTime";

describe("isValidInt64NanosecondDateTime", () => {
  it.each`
    value                                          | expected | label
    ${"1677-09-21T00:12:43.145224192"}             | ${true}  | ${"'1677-09-21T00:12:43.145224192'"}
    ${"1677-09-21T00:12:43.145224191"}             | ${false} | ${"'1677-09-21T00:12:43.145224191'"}
    ${"2262-04-11T23:47:16.854775807"}             | ${true}  | ${"'2262-04-11T23:47:16.854775807'"}
    ${"2262-04-11T23:47:16.854775808"}             | ${false} | ${"'2262-04-11T23:47:16.854775808'"}
    ${"1970-01-01T00:00:00"}                       | ${true}  | ${"'1970-01-01T00:00:00'"}
    ${"2024-01-01T00:00:00[Asia/Tokyo]"}           | ${true}  | ${"'2024-01-01T00:00:00[Asia/Tokyo]'"}
    ${"+010000-01-01T00:00:00"}                    | ${false} | ${"'+010000-01-01T00:00:00'"}
    ${"+275760-09-13T00:00:00"}                    | ${false} | ${"'+275760-09-13T00:00:00'"}
    ${"2024-01-01T00:00:00Z"}                      | ${false} | ${"'2024-01-01T00:00:00Z'"}
    ${"2024-01-01T00:00:00+01:00"}                 | ${false} | ${"'2024-01-01T00:00:00+01:00'"}
    ${"2024-01-01T09:00:00+09:00[Asia/Tokyo]"}     | ${false} | ${"'2024-01-01T09:00:00+09:00[Asia/Tokyo]'"}
    ${"2262-04-11T23:47:16.854775807Z"}            | ${false} | ${"'2262-04-11T23:47:16.854775807Z'"}
    ${"2262-04-11T23:47:16.854775807[Asia/Tokyo]"} | ${true}  | ${"'2262-04-11T23:47:16.854775807[Asia/Tokyo]'"}
    ${"2262-04-11T23:47:16.854775808[Asia/Tokyo]"} | ${false} | ${"'2262-04-11T23:47:16.854775808[Asia/Tokyo]'"}
    ${"-271821-04-20T00:00:00"}                    | ${false} | ${"'-271821-04-20T00:00:00'"}
    ${"2024-01-01"}                                | ${false} | ${"'2024-01-01'"}
    ${"2024-01-01T23:59:60"}                       | ${false} | ${"'2024-01-01T23:59:60'"}
    ${"invalid"}                                   | ${false} | ${"'invalid'"}
    ${""}                                          | ${false} | ${"''"}
  `("returns $expected for $label", ({ value, expected }) => {
    expect(isValidInt64NanosecondDateTime(value)).toBe(expected);
  });

  it("returns false for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidInt64NanosecondDateTime(make()), kind).toBe(false);
    }
  });

  it("returns true through both overloads for a valid string", () => {
    expect(isValidInt64NanosecondDateTime("2024-01-01T00:00:00")).toBe(true);
    expect(isValidInt64NanosecondDateTime(arrives("2024-01-01T00:00:00"))).toBe(
      true,
    );
  });
});

describe("isValidInt64NanosecondDateTime types", () => {
  it("narrows a value typed unknown to string when it is valid", () => {
    const input = arrives("2024-01-01T00:00:00");
    if (isValidInt64NanosecondDateTime(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    } else {
      expectTypeOf(input).toEqualTypeOf<unknown>();
    }
    expect(isValidInt64NanosecondDateTime(input)).toBe(true);
  });

  it("keeps a string a string when it is not valid", () => {
    const input: string = "2024-01-01T00:00:00Z";
    if (!isValidInt64NanosecondDateTime(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidInt64NanosecondDateTime(input)).toBe(false);
  });

  // A predicate on `string | null` would type an invalid string as `null` on a false result, so
  // a typed union gets a plain boolean and narrows on neither branch.
  it("leaves string | null as it is on both branches", () => {
    const check = (input: string | null): boolean => {
      if (isValidInt64NanosecondDateTime(input)) {
        expectTypeOf(input).toEqualTypeOf<string | null>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | null>();
      return false;
    };
    expect(check("2024-01-01T00:00:00")).toBe(true);
    expect(check(null)).toBe(false);
  });

  it("leaves string | void as it is on both branches", () => {
    const check = (input: string | void): boolean => {
      if (isValidInt64NanosecondDateTime(input)) {
        expectTypeOf(input).toEqualTypeOf<string | void>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | void>();
      return false;
    };
    expect(check("2024-01-01T00:00:00")).toBe(true);
    expect(check(undefined)).toBe(false);
  });

  it("filters an unknown[] to string[]", () => {
    const values = [null, "2024-01-01T00:00:00", 1, "2024-01-01T00:00:00Z"].map(
      arrives,
    );
    const kept = values.filter(isValidInt64NanosecondDateTime);
    expectTypeOf(kept).toEqualTypeOf<string[]>();
    expect(kept).toEqual(["2024-01-01T00:00:00"]);
  });
});
