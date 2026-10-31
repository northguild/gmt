import { isValidDate } from "./isValidDate";
import { arrives, NON_STRINGS } from "../../test/nonStrings";

describe("isValidDate", () => {
  it.each`
    value
    ${"2024-02-29"}
    ${"2024-01-01"}
    ${"2024-12-31"}
    ${"2024-03-31"}
    ${"0000-01-01"}
    ${"+001234-12-31"}
  `("returns true for valid date: $value", ({ value }: { value: string }) => {
    expect(isValidDate(value)).toBe(true);
  });

  it.each`
    value
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${"2023-02-29"}
    ${"-0001-01-01"}
    ${"not-a-date"}
  `(
    "returns false for invalid date: $value",
    ({ value }: { value: string }) => {
      expect(isValidDate(value)).toBe(false);
    },
  );

  // Temporal's ISO string grammar (proposal-temporal spec/abstractops.html `Annotations`,
  // `ParseISODateTime`; RFC 9557 §3.3): an elective annotation is read and ignored, a time zone
  // annotation is ignored for a PlainDate, the first `u-ca` annotation names the calendar, and an
  // unknown critical annotation is rejected. Values checked against native Temporal (Chromium
  // 153) except `[a=bc]`: native rejects a one-character key, which the spec grammar
  // (`AKeyLeadingChar`) allows.
  it.each`
    value
    ${"2024-03-10[foo=bar]"}
    ${"2024-03-10[_foo=bar]"}
    ${"2024-03-10[x-foo=bar-baz]"}
    ${"2024-03-10[foo=bar][foo=baz]"}
    ${"2024-03-10[a=bc]"}
    ${"2024-03-10[Asia/Tokyo]"}
    ${"2024-03-10[!Asia/Tokyo]"}
    ${"2024-03-10[+05:00]"}
    ${"2024-03-10[Not/AZone]"}
    ${"2024-03-10[Asia/Tokyo][foo=bar][u-ca=iso8601]"}
    ${"2024-03-10[u-ca=iso8601]"}
    ${"2024-03-10[!u-ca=iso8601]"}
    ${"2024-03-10[u-ca=ISO8601]"}
    ${"2024-03-10[u-ca=iso8601][u-ca=hebrew]"}
  `(
    "returns true for a PlainDate with annotations Temporal reads and ignores: $value",
    ({ value }: { value: string }) => {
      expect(isValidDate(value)).toBe(true);
    },
  );

  it.each`
    value                                       | reason
    ${"2024-03-10[!foo=bar]"}                   | ${"unknown critical annotation"}
    ${"2024-03-10[FOO=bar]"}                    | ${"upper-case key"}
    ${"2024-03-10[foo=]"}                       | ${"empty value"}
    ${"2024-03-10[foo=bar"}                     | ${"unclosed annotation"}
    ${"2024-03-10[]"}                           | ${"empty annotation"}
    ${"2024-03-10[!u-ca=iso8601][u-ca=hebrew]"} | ${"second u-ca with a critical flag"}
    ${"2024-03-10[u-ca=iso8601][Asia/Tokyo]"}   | ${"time zone annotation after a key"}
    ${"2024-03-10[foo=bar][Asia/Tokyo]"}        | ${"time zone annotation after a key"}
    ${"2024-03-10[Asia/Tokyo][Europe/Paris]"}   | ${"two time zone annotations"}
    ${"2024-03-10[foo=bar][!baz=q]"}            | ${"unknown critical annotation"}
    ${"2024-03-10[u-ca=bogus]"}                 | ${"unknown calendar"}
    ${"2024-03-10[u-ca=hebrew]"}                | ${"non-ISO calendar: isValidCalendarDate reads it"}
    ${"2024-03-10[u-ca=gregory]"}               | ${"non-ISO calendar: isValidCalendarDate reads it"}
    ${"2024-02-30[foo=bar]"}                    | ${"invalid date"}
    ${"2024-03-10T12:00[foo=bar]"}              | ${"a date-time, not a date"}
    ${"2026-10"}                                | ${"a year-month, not a date: isValidYearMonth reads it"}
  `("returns false for $value ($reason)", ({ value }: { value: string }) => {
    expect(isValidDate(value)).toBe(false);
  });
});

describe("isValidDate with any value", () => {
  it("returns false for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidDate(make()), kind).toBe(false);
    }
  });

  it("returns true for a valid string typed unknown, as for a string", () => {
    expect(isValidDate(arrives("2024-03-10"))).toBe(true);
    expect(isValidDate("2024-03-10")).toBe(true);
  });
});

describe("isValidDate types", () => {
  it("narrows a value typed unknown to string when it is valid", () => {
    const input = arrives("2024-03-10");
    if (isValidDate(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    } else {
      expectTypeOf(input).toEqualTypeOf<unknown>();
    }
    expect(isValidDate(input)).toBe(true);
  });

  it("keeps a string a string when it is not valid", () => {
    const input: string = "invalid";
    if (!isValidDate(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidDate(input)).toBe(false);
  });

  it("leaves string | null as it is on both branches", () => {
    const check = (input: string | null): boolean => {
      if (isValidDate(input)) {
        expectTypeOf(input).toEqualTypeOf<string | null>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | null>();
      return false;
    };
    expect(check("2024-03-10")).toBe(true);
    expect(check(null)).toBe(false);
  });

  it("leaves string | void as it is on both branches", () => {
    const check = (input: string | void): boolean => {
      if (isValidDate(input)) {
        expectTypeOf(input).toEqualTypeOf<string | void>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | void>();
      return false;
    };
    expect(check("2024-03-10")).toBe(true);
    expect(check(undefined)).toBe(false);
  });

  it("filters an unknown[] to string[]", () => {
    const values = [null, "2024-03-10", 1, "invalid"].map(arrives);
    const kept = values.filter(isValidDate);
    expectTypeOf(kept).toEqualTypeOf<string[]>();
    expect(kept).toEqual(["2024-03-10"]);
  });
});
