import { isValidTime } from "./isValidTime";
import { arrives, NON_STRINGS } from "../../test/nonStrings";

describe("isValidTime", () => {
  it.each`
    value
    ${"00:00:00"}
    ${"12:00:00"}
    ${"23:59:59"}
    ${"08:30"}
    ${"08:30:45.123"}
    ${"08:30:45,123"}
    ${"12:34:56.123456789"}
  `("returns true for valid time: $value", ({ value }: { value: string }) => {
    expect(isValidTime(value)).toBe(true);
  });

  it.each`
    value
    ${"8:30:45"}
    ${"24:00:00"}
    ${"23:59:60"}
    ${"12:34:56.1234567891"}
    ${"hello"}
  `(
    "returns false for invalid time: $value",
    ({ value }: { value: string }) => {
      expect(isValidTime(value)).toBe(false);
    },
  );

  // Temporal's ISO string grammar (proposal-temporal spec/abstractops.html `Annotations`,
  // `ParseISODateTime`; RFC 9557 §3.3): an elective annotation is read and ignored, a time zone
  // annotation is ignored for a PlainTime, the first `u-ca` annotation names the calendar, and an
  // unknown critical annotation is rejected. Values checked against native Temporal (Chromium
  // 153) except `[a=bc]`: native rejects a one-character key, which the spec grammar
  // (`AKeyLeadingChar`) allows.
  it.each`
    value
    ${"12:30[foo=bar]"}
    ${"12:30[_foo=bar]"}
    ${"12:30[x-foo=bar-baz]"}
    ${"12:30[foo=bar][foo=baz]"}
    ${"12:30[a=bc]"}
    ${"12:30[Asia/Tokyo]"}
    ${"12:30[!Asia/Tokyo]"}
    ${"12:30[+05:00]"}
    ${"12:30[Not/AZone]"}
    ${"12:30[Asia/Tokyo][foo=bar][u-ca=iso8601]"}
    ${"12:30[u-ca=iso8601]"}
    ${"12:30[!u-ca=iso8601]"}
    ${"12:30[u-ca=ISO8601]"}
    ${"12:30[u-ca=iso8601][u-ca=hebrew]"}
    ${"12:30[u-ca=hebrew]"}
    ${"12:30[u-ca=bogus]"}
  `(
    "returns true for a PlainTime with annotations Temporal reads and ignores: $value",
    ({ value }: { value: string }) => {
      expect(isValidTime(value)).toBe(true);
    },
  );

  it.each`
    value                                  | reason
    ${"12:30[!foo=bar]"}                   | ${"unknown critical annotation"}
    ${"12:30[FOO=bar]"}                    | ${"upper-case key"}
    ${"12:30[foo=]"}                       | ${"empty value"}
    ${"12:30[foo=bar"}                     | ${"unclosed annotation"}
    ${"12:30[]"}                           | ${"empty annotation"}
    ${"12:30[!u-ca=iso8601][u-ca=hebrew]"} | ${"second u-ca with a critical flag"}
    ${"12:30[u-ca=iso8601][Asia/Tokyo]"}   | ${"time zone annotation after a key"}
    ${"12:30[foo=bar][Asia/Tokyo]"}        | ${"time zone annotation after a key"}
    ${"12:30[Asia/Tokyo][Europe/Paris]"}   | ${"two time zone annotations"}
    ${"12:30[foo=bar][!baz=q]"}            | ${"unknown critical annotation"}
    ${"23:59:60[foo=bar]"}                 | ${"leap second"}
    ${"12:30Z[foo=bar]"}                   | ${"UTC designator"}
  `("returns false for $value ($reason)", ({ value }: { value: string }) => {
    expect(isValidTime(value)).toBe(false);
  });
});

describe("isValidTime with any value", () => {
  it("returns false for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidTime(make()), kind).toBe(false);
    }
  });

  it("returns true for a valid string typed unknown, as for a string", () => {
    expect(isValidTime(arrives("12:34:56"))).toBe(true);
    expect(isValidTime("12:34:56")).toBe(true);
  });
});

describe("isValidTime types", () => {
  it("narrows a value typed unknown to string when it is valid", () => {
    const input = arrives("12:34:56");
    if (isValidTime(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    } else {
      expectTypeOf(input).toEqualTypeOf<unknown>();
    }
    expect(isValidTime(input)).toBe(true);
  });

  it("keeps a string a string when it is not valid", () => {
    const input: string = "invalid";
    if (!isValidTime(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidTime(input)).toBe(false);
  });

  it("leaves string | null as it is on both branches", () => {
    const check = (input: string | null): boolean => {
      if (isValidTime(input)) {
        expectTypeOf(input).toEqualTypeOf<string | null>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | null>();
      return false;
    };
    expect(check("12:34:56")).toBe(true);
    expect(check(null)).toBe(false);
  });

  it("leaves string | void as it is on both branches", () => {
    const check = (input: string | void): boolean => {
      if (isValidTime(input)) {
        expectTypeOf(input).toEqualTypeOf<string | void>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | void>();
      return false;
    };
    expect(check("12:34:56")).toBe(true);
    expect(check(undefined)).toBe(false);
  });

  it("filters an unknown[] to string[]", () => {
    const values = [null, "12:34:56", 1, "invalid"].map(arrives);
    const kept = values.filter(isValidTime);
    expectTypeOf(kept).toEqualTypeOf<string[]>();
    expect(kept).toEqual(["12:34:56"]);
  });
});
