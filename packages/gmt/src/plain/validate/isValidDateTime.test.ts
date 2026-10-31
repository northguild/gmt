import { isValidDateTime } from "./isValidDateTime";
import { arrives, NON_STRINGS } from "../../test/nonStrings";

describe("isValidDateTime", () => {
  it.each`
    value
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T12:00:00"}
    ${"2024-02-29T23:59:59"}
    ${"2024-02-29T08:30:45.123"}
    ${"0000-01-01T00:00"}
    ${"+001234-12-31T23:59"}
  `(
    "returns true for valid date-time: $value",
    ({ value }: { value: string }) => {
      expect(isValidDateTime(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"2024-02-30T12:00:00"}
    ${"2024-02-29T24:00:00"}
    ${"2024-02-29T23:59:60"}
    ${"2024-02-29T12:30:45.1234567891"}
    ${"-0001-01-01T00:00"}
    ${"not-a-datetime"}
  `(
    "returns false for invalid date-time: $value",
    ({ value }: { value: string }) => {
      expect(isValidDateTime(value)).toBe(false);
    },
  );

  // Temporal's ISO string grammar (proposal-temporal spec/abstractops.html `Annotations`,
  // `ParseISODateTime`; RFC 9557 §3.3): an elective annotation is read and ignored, a time zone
  // annotation is ignored for a PlainDateTime, the first `u-ca` annotation names the calendar, and an
  // unknown critical annotation is rejected. Values checked against native Temporal (Chromium
  // 153) except `[a=bc]`: native rejects a one-character key, which the spec grammar
  // (`AKeyLeadingChar`) allows.
  it.each`
    value
    ${"2024-03-10T12:30[foo=bar]"}
    ${"2024-03-10T12:30[_foo=bar]"}
    ${"2024-03-10T12:30[x-foo=bar-baz]"}
    ${"2024-03-10T12:30[foo=bar][foo=baz]"}
    ${"2024-03-10T12:30[a=bc]"}
    ${"2024-03-10T12:30[Asia/Tokyo]"}
    ${"2024-03-10T12:30[!Asia/Tokyo]"}
    ${"2024-03-10T12:30[+05:00]"}
    ${"2024-03-10T12:30[Not/AZone]"}
    ${"2024-03-10T12:30[Asia/Tokyo][foo=bar][u-ca=iso8601]"}
    ${"2024-03-10T12:30[u-ca=iso8601]"}
    ${"2024-03-10T12:30[!u-ca=iso8601]"}
    ${"2024-03-10T12:30[u-ca=ISO8601]"}
    ${"2024-03-10T12:30[u-ca=iso8601][u-ca=hebrew]"}
  `(
    "returns true for a PlainDateTime with annotations Temporal reads and ignores: $value",
    ({ value }: { value: string }) => {
      expect(isValidDateTime(value)).toBe(true);
    },
  );

  it.each`
    value                                             | reason
    ${"2024-03-10T12:30[!foo=bar]"}                   | ${"unknown critical annotation"}
    ${"2024-03-10T12:30[FOO=bar]"}                    | ${"upper-case key"}
    ${"2024-03-10T12:30[foo=]"}                       | ${"empty value"}
    ${"2024-03-10T12:30[foo=bar"}                     | ${"unclosed annotation"}
    ${"2024-03-10T12:30[]"}                           | ${"empty annotation"}
    ${"2024-03-10T12:30[!u-ca=iso8601][u-ca=hebrew]"} | ${"second u-ca with a critical flag"}
    ${"2024-03-10T12:30[u-ca=iso8601][Asia/Tokyo]"}   | ${"time zone annotation after a key"}
    ${"2024-03-10T12:30[foo=bar][Asia/Tokyo]"}        | ${"time zone annotation after a key"}
    ${"2024-03-10T12:30[Asia/Tokyo][Europe/Paris]"}   | ${"two time zone annotations"}
    ${"2024-03-10T12:30[foo=bar][!baz=q]"}            | ${"unknown critical annotation"}
    ${"2024-03-10T12:30[u-ca=bogus]"}                 | ${"unknown calendar"}
    ${"2024-03-10T12:30[u-ca=hebrew]"}                | ${"non-ISO calendar"}
    ${"2024-03-10T24:00[foo=bar]"}                    | ${"invalid hour"}
    ${"2016-12-31T23:59:60[foo=bar]"}                 | ${"leap second"}
    ${"2024-03-10[foo=bar]"}                          | ${"a date, not a date-time"}
    ${"2024-03-10T12:30Z[foo=bar]"}                   | ${"UTC designator"}
  `("returns false for $value ($reason)", ({ value }: { value: string }) => {
    expect(isValidDateTime(value)).toBe(false);
  });
});

describe("isValidDateTime with any value", () => {
  it("returns false for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidDateTime(make()), kind).toBe(false);
    }
  });

  it("returns true for a valid string typed unknown, as for a string", () => {
    expect(isValidDateTime(arrives("2024-02-29T12:34:56"))).toBe(true);
    expect(isValidDateTime("2024-02-29T12:34:56")).toBe(true);
  });
});

describe("isValidDateTime types", () => {
  it("narrows a value typed unknown to string when it is valid", () => {
    const input = arrives("2024-02-29T12:34:56");
    if (isValidDateTime(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    } else {
      expectTypeOf(input).toEqualTypeOf<unknown>();
    }
    expect(isValidDateTime(input)).toBe(true);
  });

  it("keeps a string a string when it is not valid", () => {
    const input: string = "invalid";
    if (!isValidDateTime(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidDateTime(input)).toBe(false);
  });

  it("leaves string | null as it is on both branches", () => {
    const check = (input: string | null): boolean => {
      if (isValidDateTime(input)) {
        expectTypeOf(input).toEqualTypeOf<string | null>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | null>();
      return false;
    };
    expect(check("2024-02-29T12:34:56")).toBe(true);
    expect(check(null)).toBe(false);
  });

  it("leaves string | void as it is on both branches", () => {
    const check = (input: string | void): boolean => {
      if (isValidDateTime(input)) {
        expectTypeOf(input).toEqualTypeOf<string | void>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | void>();
      return false;
    };
    expect(check("2024-02-29T12:34:56")).toBe(true);
    expect(check(undefined)).toBe(false);
  });

  it("filters an unknown[] to string[]", () => {
    const values = [null, "2024-02-29T12:34:56", 1, "invalid"].map(arrives);
    const kept = values.filter(isValidDateTime);
    expectTypeOf(kept).toEqualTypeOf<string[]>();
    expect(kept).toEqual(["2024-02-29T12:34:56"]);
  });
});
