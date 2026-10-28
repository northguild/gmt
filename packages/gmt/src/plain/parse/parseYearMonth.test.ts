import { mockTemporalPlainYearMonthFromThrow } from "../../test/mocks";
import { isValidYearMonth } from "../validate";
import { parseYearMonth } from "./parseYearMonth";

const VALID: string[] = [
  "2026-10",
  "0000-01",
  "-000001-12",
  "+002026-10",
  "-271821-04",
  "+275760-09",
  "2026-10[u-ca=iso8601]",
  "2026-10[u-ca=ISO8601]",
  "2026-10[!u-ca=Iso8601]",
  "2026-10[Europe/Paris]",
  "2026-10[!Europe/Paris]",
  "2026-10[foo=bar]",
  "+275760-09[u-ca=ISO8601]",
  "-271821-04[!u-ca=ISO8601]",
  "2026-10[u-ca=ISO8601][u-ca=gregory]",
  "2026-10[u-ca=iso8601][foo=bar]",
];

const INVALID: string[] = [
  "-271821-03",
  "+275760-10",
  "202610",
  "2026-1",
  "2026-13",
  "2026-00",
  "-000000-01",
  "26-10",
  "2026-10-01",
  "2026-10-01T10:00",
  "2026-10[u-ca=gregory]",
  "2026-10[u-ca=hebrew]",
  "2026-10[!foo=bar]",
  "2026-10[U-CA=iso8601]",
  "-271821-03[u-ca=ISO8601]",
  "+275760-10[u-ca=ISO8601]",
  "2026-10[u-ca=GREGORY][u-ca=ISO8601]",
  "2026-10[!u-ca=ISO8601][u-ca=gregory]",
  "2026-10[u-ca=ISO8601][!foo=bar]",
  "2026-10Z",
  "2026-10+01:00",
  " 2026-10",
  "10/2026",
  "--10-01",
  "",
];

describe("parseYearMonth", () => {
  it.each`
    value                                    | expected
    ${"2026-10"}                             | ${"2026-10"}
    ${"0000-01"}                             | ${"0000-01"}
    ${"-000001-12"}                          | ${"-000001-12"}
    ${"+002026-10"}                          | ${"2026-10"}
    ${"+010000-01"}                          | ${"+010000-01"}
    ${"-271821-04"}                          | ${"-271821-04"}
    ${"+275760-09"}                          | ${"+275760-09"}
    ${"2026-10[u-ca=iso8601]"}               | ${"2026-10"}
    ${"2026-10[u-ca=ISO8601]"}               | ${"2026-10"}
    ${"2026-10[!u-ca=Iso8601]"}              | ${"2026-10"}
    ${"2026-10[Europe/Paris]"}               | ${"2026-10"}
    ${"2026-10[!Europe/Paris]"}              | ${"2026-10"}
    ${"2026-10[foo=bar]"}                    | ${"2026-10"}
    ${"+275760-09[u-ca=ISO8601]"}            | ${"+275760-09"}
    ${"-271821-04[!u-ca=ISO8601]"}           | ${"-271821-04"}
    ${"2026-10[u-ca=ISO8601][u-ca=gregory]"} | ${"2026-10"}
  `(
    "returns '$expected' for '$value'",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(parseYearMonth(value)).toBe(expected);
    },
  );

  it.each(INVALID)("returns '' for the invalid year-month '%s'", (value) => {
    expect(parseYearMonth(value)).toBe("");
  });

  it.each`
    label          | value
    ${"null"}      | ${null}
    ${"undefined"} | ${undefined}
    ${"{}"}        | ${{}}
    ${"202610"}    | ${202610}
  `("returns '' for the non-string $label", ({ value }: { value: unknown }) => {
    expect(parseYearMonth(value as string)).toBe("");
  });

  it.each([...VALID, ...INVALID])(
    "agrees with isValidYearMonth for '%s'",
    (value) => {
      expect(isValidYearMonth(value)).toBe(parseYearMonth(value) !== "");
    },
  );

  it.each(VALID)("is idempotent for '%s'", (value) => {
    expect(parseYearMonth(parseYearMonth(value))).toBe(parseYearMonth(value));
  });

  it("returns '' when Temporal throws", () => {
    mockTemporalPlainYearMonthFromThrow();
    expect(parseYearMonth("2026-10")).toBe("");
  });
});
