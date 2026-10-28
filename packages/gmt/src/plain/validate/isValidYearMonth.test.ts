import { mockTemporalPlainYearMonthFromThrow } from "../../test/mocks";
import { isValidYearMonth } from "./isValidYearMonth";

// Temporal grammar DateSpecYearMonth (DateYear DateSeparator DateMonth), ISOYearMonthWithinLimits
// for the range, ParseISODateTime for the annotations. The basic form is a GMT rule.
describe("isValidYearMonth", () => {
  it.each`
    value                                    | why
    ${"2026-10"}                             | ${"DateSpecYearMonth"}
    ${"0000-01"}                             | ${"year zero"}
    ${"-000001-12"}                          | ${"a negative year"}
    ${"+002026-10"}                          | ${"six-digit year"}
    ${"-271821-04"}                          | ${"earliest year-month (ISOYearMonthWithinLimits)"}
    ${"+275760-09"}                          | ${"latest year-month (ISOYearMonthWithinLimits)"}
    ${"2026-10[u-ca=iso8601]"}               | ${"ISO calendar annotation"}
    ${"2026-10[u-ca=ISO8601]"}               | ${"ParseISODateTime lowercases the calendar (D20)"}
    ${"2026-10[!u-ca=Iso8601]"}              | ${"critical and mixed case (D20)"}
    ${"2026-10[Europe/Paris]"}               | ${"time zone annotation ignored"}
    ${"2026-10[!Europe/Paris]"}              | ${"critical time zone annotation (AnnotatedYearMonth)"}
    ${"2026-10[foo=bar]"}                    | ${"elective annotation ignored"}
    ${"2026-10[Europe/Paris][u-ca=ISO8601]"} | ${"time zone annotation then a case-insensitive calendar"}
    ${"+275760-09[u-ca=ISO8601]"}            | ${"latest year-month with a case-insensitive calendar (D20)"}
    ${"-271821-04[!u-ca=ISO8601]"}           | ${"earliest year-month with a critical calendar (D20)"}
    ${"2026-10[u-ca=ISO8601][u-ca=gregory]"} | ${"the first u-ca wins, and it is iso8601"}
    ${"2026-10[u-ca=iso8601][foo=bar]"}      | ${"elective annotation after the calendar"}
  `("returns true for '$value' ($why)", ({ value }: { value: string }) => {
    expect(isValidYearMonth(value)).toBe(true);
  });

  it.each`
    value                                     | why
    ${"-271821-03"}                           | ${"ISOYearMonthWithinLimits: before April -271821"}
    ${"+275760-10"}                           | ${"ISOYearMonthWithinLimits: after September 275760"}
    ${"202610"}                               | ${"basic form, GMT rule"}
    ${"2026-1"}                               | ${"DateMonth: not zero-padded"}
    ${"2026-13"}                              | ${"DateMonth: month 13"}
    ${"2026-00"}                              | ${"DateMonth: month zero"}
    ${"-000000-01"}                           | ${"DateYear: -000000 is not a year"}
    ${"26-10"}                                | ${"DateYear: two digits"}
    ${"2026-10-01"}                           | ${"a full date"}
    ${"2026-10-01T10:00"}                     | ${"a date-time"}
    ${"2026-10[u-ca=gregory]"}                | ${"ParseISODateTime: only iso8601 without a day"}
    ${"2026-10[u-ca=hebrew]"}                 | ${"ParseISODateTime: only iso8601 without a day"}
    ${"2026-10[!foo=bar]"}                    | ${"unknown critical annotation"}
    ${"2026-10[U-CA=iso8601]"}                | ${"AnnotationKey is lower case"}
    ${"-271821-03[u-ca=ISO8601]"}             | ${"range is checked with a valid annotation"}
    ${"+275760-10[u-ca=ISO8601]"}             | ${"range is checked with a valid annotation"}
    ${"2026-10[u-ca=GREGORY][u-ca=ISO8601]"}  | ${"the first u-ca wins, and it is not iso8601"}
    ${"2026-10[!u-ca=ISO8601][u-ca=gregory]"} | ${"a second u-ca after a critical one"}
    ${"2026-10[u-ca=ISO8601][!foo=bar]"}      | ${"unknown critical annotation after a valid calendar"}
    ${"2026-10Z"}                             | ${"no UTC designator"}
    ${"2026-10+01:00"}                        | ${"no offset"}
    ${" 2026-10"}                             | ${"leading space"}
    ${"10/2026"}                              | ${"not ISO"}
    ${"--10-01"}                              | ${"a month-day"}
    ${""}                                     | ${"empty string"}
  `("returns false for '$value' ($why)", ({ value }: { value: string }) => {
    expect(isValidYearMonth(value)).toBe(false);
  });

  it.each`
    label          | value
    ${"null"}      | ${null}
    ${"undefined"} | ${undefined}
    ${"{}"}        | ${{}}
    ${"202610"}    | ${202610}
  `(
    "returns false for the non-string $label",
    ({ value }: { value: unknown }) => {
      expect(isValidYearMonth(value as string)).toBe(false);
    },
  );

  it("returns false when Temporal throws", () => {
    mockTemporalPlainYearMonthFromThrow();
    expect(isValidYearMonth("2026-10")).toBe(false);
  });
});
