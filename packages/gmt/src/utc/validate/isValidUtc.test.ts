import { isValidUtc } from "./isValidUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("isValidUtc", () => {
  it.each`
    value
    ${"2024-01-01T00:00:00Z"}
    ${"2024-12-31T23:59:59Z"}
    ${"2024-02-29T14:30:45Z"}
    ${"2024-02-29T14:30:45.123Z"}
    ${"2024-02-29T14:30:45,999Z"}
    ${"2024-02-29T14:30Z"}
    ${"+001234-12-31T23:59:59Z"}
  `(
    "returns true for valid UTC datetime: $value",
    ({ value }: { value: string }) => {
      expect(isValidUtc(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"2024-02-29T14:30:45"}
    ${"2024-02-29"}
    ${"2024-02-29Z"}
    ${"2024-02-29T24:00:00Z"}
    ${"not-a-datetime"}
    ${"2024-02-29T14:30Z "}
    ${"2024-02-29T14:30:45z"}
    ${"2024-02-29T14:30:45z[foo=bar]"}
    ${"2024-02-29t14:30:45Z"}
    ${"2024-02-29 14:30:45Z"}
    ${"20240229T143045Z"}
  `(
    "returns false for invalid UTC datetime: $value",
    ({ value }: { value: string }) => {
      expect(isValidUtc(value)).toBe(false);
    },
  );

  it.each`
    value
    ${"2024-12-31T23:59:60Z"}
    ${"2024-12-31T23:59:60.123Z"}
  `(
    "returns false for leap-second input: $value",
    ({ value }: { value: string }) => {
      expect(isValidUtc(value)).toBe(false);
    },
  );

  it("returns false when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(isValidUtc("2024-01-01T00:00:00Z")).toBe(false);
  });

  // Temporal's ISO string grammar (proposal-temporal spec/abstractops.html `Annotations`,
  // `ParseISODateTime`; RFC 9557 §3.3): an elective annotation is read and ignored, a time zone
  // annotation is ignored for a UTC instant, the first `u-ca` annotation names the calendar, and an
  // unknown critical annotation is rejected. Values checked against native Temporal (Chromium
  // 153) except `[a=bc]`: native rejects a one-character key, which the spec grammar
  // (`AKeyLeadingChar`) allows.
  it.each`
    value
    ${"2024-03-10T12:30Z[foo=bar]"}
    ${"2024-03-10T12:30Z[_foo=bar]"}
    ${"2024-03-10T12:30Z[x-foo=bar-baz]"}
    ${"2024-03-10T12:30Z[foo=bar][foo=baz]"}
    ${"2024-03-10T12:30Z[a=bc]"}
    ${"2024-03-10T12:30Z[Asia/Tokyo]"}
    ${"2024-03-10T12:30Z[!Asia/Tokyo]"}
    ${"2024-03-10T12:30Z[+05:00]"}
    ${"2024-03-10T12:30Z[Not/AZone]"}
    ${"2024-03-10T12:30Z[Asia/Tokyo][foo=bar][u-ca=iso8601]"}
    ${"2024-03-10T12:30Z[u-ca=iso8601]"}
    ${"2024-03-10T12:30Z[!u-ca=iso8601]"}
    ${"2024-03-10T12:30Z[u-ca=ISO8601]"}
    ${"2024-03-10T12:30Z[u-ca=iso8601][u-ca=hebrew]"}
    ${"2024-03-10T12:30Z[u-ca=hebrew]"}
    ${"2024-03-10T12:30Z[u-ca=bogus]"}
  `(
    "returns true for a UTC instant with annotations Temporal reads and ignores: $value",
    ({ value }: { value: string }) => {
      expect(isValidUtc(value)).toBe(true);
    },
  );

  it.each`
    value                                              | reason
    ${"2024-03-10T12:30Z[!foo=bar]"}                   | ${"unknown critical annotation"}
    ${"2024-03-10T12:30Z[FOO=bar]"}                    | ${"upper-case key"}
    ${"2024-03-10T12:30Z[foo=]"}                       | ${"empty value"}
    ${"2024-03-10T12:30Z[foo=bar"}                     | ${"unclosed annotation"}
    ${"2024-03-10T12:30Z[]"}                           | ${"empty annotation"}
    ${"2024-03-10T12:30Z[!u-ca=iso8601][u-ca=hebrew]"} | ${"second u-ca with a critical flag"}
    ${"2024-03-10T12:30Z[u-ca=iso8601][Asia/Tokyo]"}   | ${"time zone annotation after a key"}
    ${"2024-03-10T12:30Z[foo=bar][Asia/Tokyo]"}        | ${"time zone annotation after a key"}
    ${"2024-03-10T12:30Z[Asia/Tokyo][Europe/Paris]"}   | ${"two time zone annotations"}
    ${"2024-03-10T12:30Z[foo=bar][!baz=q]"}            | ${"unknown critical annotation"}
    ${"2016-12-31T23:59:60Z[foo=bar]"}                 | ${"leap second"}
    ${"2024-03-10T12:30[foo=bar]"}                     | ${"no UTC designator"}
    ${"2024-03-10T12:30+05:00[foo=bar]"}               | ${"an offset, not Z"}
  `("returns false for $value ($reason)", ({ value }: { value: string }) => {
    expect(isValidUtc(value)).toBe(false);
  });
});
