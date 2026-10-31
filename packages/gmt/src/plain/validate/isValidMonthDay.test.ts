import { mockTemporalPlainMonthDayFromThrow } from "../../test/mocks";
import { isValidMonthDay } from "./isValidMonthDay";
import { arrives, NON_STRINGS } from "../../test/nonStrings";

// Temporal grammar DateSpecMonthDay (`--`? DateMonth DateSeparator DateDay) with the early error
// IsValidMonthDay; ParseISODateTime for the annotations. The basic form is a GMT rule.
describe("isValidMonthDay", () => {
  it.each`
    value                                    | why
    ${"--12-25"}                             | ${"DateSpecMonthDay"}
    ${"12-25"}                               | ${"the -- is optional"}
    ${"--02-29"}                             | ${"exists in the 1972 reference year"}
    ${"--01-31"}                             | ${"last day of a 31-day month"}
    ${"--04-30"}                             | ${"last day of a 30-day month"}
    ${"--12-01"}                             | ${"first day"}
    ${"--12-25[u-ca=iso8601]"}               | ${"ISO calendar annotation"}
    ${"--12-25[u-ca=ISO8601]"}               | ${"ParseISODateTime lowercases the calendar (D20)"}
    ${"--12-25[!u-ca=Iso8601]"}              | ${"critical and mixed case (D20)"}
    ${"--12-25[u-ca=iso8601][u-ca=gregory]"} | ${"a second non-critical u-ca is ignored"}
    ${"--12-25[u-ca=ISO8601][u-ca=GREGORY]"} | ${"first u-ca wins; the second is ignored in any case (D20)"}
    ${"--12-25[_foo=bar]"}                   | ${"elective annotation ignored"}
    ${"--12-25[Europe/Paris]"}               | ${"TimeZoneAnnotation in AnnotatedMonthDay"}
    ${"--12-25[+01:00]"}                     | ${"offset time zone annotation"}
    ${"11-18[+01:00][u-ca=ISO8601]"}         | ${"offset annotation then a case-insensitive calendar (test262 argument-string-calendar-case-insensitive)"}
    ${"--12-25[!Europe/Paris]"}              | ${"critical time zone annotation"}
    ${"--12-25[foo=bar]"}                    | ${"elective annotation ignored"}
  `("returns true for '$value' ($why)", ({ value }: { value: string }) => {
    expect(isValidMonthDay(value)).toBe(true);
  });

  it.each`
    value                                     | why
    ${"--02-30"}                              | ${"IsValidMonthDay: February has no 30th"}
    ${"--02-31"}                              | ${"IsValidMonthDay: February has no 31st"}
    ${"--04-31"}                              | ${"IsValidMonthDay: April has 30 days"}
    ${"--06-31"}                              | ${"IsValidMonthDay: June has 30 days"}
    ${"--09-31"}                              | ${"IsValidMonthDay: September has 30 days"}
    ${"--11-31"}                              | ${"IsValidMonthDay: November has 30 days"}
    ${"--00-10"}                              | ${"DateMonth: month zero"}
    ${"--13-01"}                              | ${"DateMonth: month 13"}
    ${"--12-00"}                              | ${"DateDay: day zero"}
    ${"--12-32"}                              | ${"DateDay: day 32"}
    ${"--1225"}                               | ${"basic form, GMT rule"}
    ${"1225"}                                 | ${"basic form without the dashes, GMT rule"}
    ${"--12"}                                 | ${"no day"}
    ${"12"}                                   | ${"no day, no dashes"}
    ${"2024-12-25"}                           | ${"a full date"}
    ${"2024-12"}                              | ${"a year-month"}
    ${"--12-25T10:00"}                        | ${"AnnotatedMonthDay has no time"}
    ${"--12-25Z"}                             | ${"AnnotatedMonthDay has no UTC designator"}
    ${"--12-25+01:00"}                        | ${"AnnotatedMonthDay has no offset"}
    ${"--12-25[u-ca=gregory]"}                | ${"ParseISODateTime: only iso8601 without a year"}
    ${"--12-25[u-ca=hebrew]"}                 | ${"ParseISODateTime: only iso8601 without a year"}
    ${"--12-25[U-CA=iso8601]"}                | ${"AnnotationKey is lower case"}
    ${"--12-25[!foo=bar]"}                    | ${"unknown critical annotation"}
    ${"--12-25[!u-ca=iso8601][u-ca=gregory]"} | ${"second u-ca after a critical one"}
    ${"--12-25[!u-ca=ISO8601][u-ca=gregory]"} | ${"second u-ca after a critical one, in any case (D20)"}
    ${"--12-25[u-ca=GREGORY][u-ca=ISO8601]"}  | ${"first u-ca wins, and it is not iso8601 (D20)"}
    ${" --12-25"}                             | ${"leading space"}
    ${"--12-25 "}                             | ${"trailing space"}
    ${"−−12-25"}                              | ${"U+2212 minus signs"}
    ${"--１２-２５"}                          | ${"full-width digits"}
    ${""}                                     | ${"empty string"}
  `("returns false for '$value' ($why)", ({ value }: { value: string }) => {
    expect(isValidMonthDay(value)).toBe(false);
  });

  it("returns false when Temporal throws", () => {
    mockTemporalPlainMonthDayFromThrow();
    expect(isValidMonthDay("--12-25")).toBe(false);
  });
});

describe("isValidMonthDay with any value", () => {
  it("returns false for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidMonthDay(make()), kind).toBe(false);
    }
  });

  it("returns true for a valid string typed unknown, as for a string", () => {
    expect(isValidMonthDay(arrives("--12-25"))).toBe(true);
    expect(isValidMonthDay("--12-25")).toBe(true);
  });
});

describe("isValidMonthDay types", () => {
  it("narrows a value typed unknown to string when it is valid", () => {
    const input = arrives("--12-25");
    if (isValidMonthDay(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    } else {
      expectTypeOf(input).toEqualTypeOf<unknown>();
    }
    expect(isValidMonthDay(input)).toBe(true);
  });

  it("keeps a string a string when it is not valid", () => {
    const input: string = "invalid";
    if (!isValidMonthDay(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidMonthDay(input)).toBe(false);
  });

  it("leaves string | null as it is on both branches", () => {
    const check = (input: string | null): boolean => {
      if (isValidMonthDay(input)) {
        expectTypeOf(input).toEqualTypeOf<string | null>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | null>();
      return false;
    };
    expect(check("--12-25")).toBe(true);
    expect(check(null)).toBe(false);
  });

  it("leaves string | void as it is on both branches", () => {
    const check = (input: string | void): boolean => {
      if (isValidMonthDay(input)) {
        expectTypeOf(input).toEqualTypeOf<string | void>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | void>();
      return false;
    };
    expect(check("--12-25")).toBe(true);
    expect(check(undefined)).toBe(false);
  });

  it("filters an unknown[] to string[]", () => {
    const values = [null, "--12-25", 1, "invalid"].map(arrives);
    const kept = values.filter(isValidMonthDay);
    expectTypeOf(kept).toEqualTypeOf<string[]>();
    expect(kept).toEqual(["--12-25"]);
  });
});
