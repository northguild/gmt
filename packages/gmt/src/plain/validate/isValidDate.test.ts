import { isValidDate } from "./isValidDate";

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
  `("returns false for $value ($reason)", ({ value }: { value: string }) => {
    expect(isValidDate(value)).toBe(false);
  });
});
