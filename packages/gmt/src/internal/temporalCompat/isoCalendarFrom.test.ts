import { monthDayFrom, yearMonthFrom } from "./isoCalendarFrom";

// Temporal ParseISODateTime, goal TemporalMonthDayString with no DateYear: "If calendar is not
// empty and the ASCII-lowercase of calendar is not "iso8601", throw a RangeError exception".
// tc39 385b479bf8 aligned the reference polyfill; polyfill 0.5.1 compares the value as written.
describe("monthDayFrom", () => {
  it.each`
    value                                    | expected
    ${"--12-25"}                             | ${"12-25"}
    ${"--12-25[u-ca=iso8601]"}               | ${"12-25"}
    ${"--12-25[u-ca=ISO8601]"}               | ${"12-25"}
    ${"12-25[u-ca=Iso8601]"}                 | ${"12-25"}
    ${"--12-25[!u-ca=ISO8601]"}              | ${"12-25"}
    ${"--12-25[u-ca=ISO8601][u-ca=GREGORY]"} | ${"12-25"}
    ${"--12-25[Europe/Paris][u-ca=ISO8601]"} | ${"12-25"}
  `(
    "reads '$value' as the month-day $expected",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(monthDayFrom(value).toString()).toBe(expected);
    },
  );

  it.each`
    value                                     | why
    ${"--12-25[u-ca=GREGORY]"}                | ${"only iso8601 is read without a year"}
    ${"--12-25[u-ca=gregory]"}                | ${"only iso8601 is read without a year"}
    ${"--12-25[u-ca=İSO8601]"}                | ${"U+0130 is outside the AnnotationValue grammar"}
    ${"--12-25[U-CA=iso8601]"}                | ${"AnnotationKey is lower case"}
    ${"--12-25[!u-ca=ISO8601][u-ca=gregory]"} | ${"second u-ca after a critical one"}
    ${"--12-25[u-ca=GREGORY][u-ca=ISO8601]"}  | ${"the first u-ca wins, and it is not iso8601"}
  `("throws RangeError for '$value' ($why)", ({ value }: { value: string }) => {
    expect(() => monthDayFrom(value)).toThrow(RangeError);
  });
});

// Temporal ParseISODateTime, goal TemporalYearMonthString with no DateDay: the same ASCII-lowercase
// check as for a month-day (tc39 385b479bf8). Polyfill 0.5.1 compares the value as written.
describe("yearMonthFrom", () => {
  it.each`
    value                                    | expected
    ${"2026-10"}                             | ${"2026-10"}
    ${"2026-10[u-ca=iso8601]"}               | ${"2026-10"}
    ${"2026-10[u-ca=ISO8601]"}               | ${"2026-10"}
    ${"2026-10[!u-ca=Iso8601]"}              | ${"2026-10"}
    ${"2026-10[Europe/Paris][u-ca=ISO8601]"} | ${"2026-10"}
    ${"2026-10[u-ca=ISO8601][u-ca=GREGORY]"} | ${"2026-10"}
    ${"+275760-09[u-ca=ISO8601]"}            | ${"+275760-09"}
    ${"-271821-04[!u-ca=ISO8601]"}           | ${"-271821-04"}
  `(
    "reads '$value' as the year-month $expected",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(yearMonthFrom(value).toString()).toBe(expected);
    },
  );

  it.each`
    value                                     | why
    ${"2026-10[u-ca=GREGORY]"}                | ${"only iso8601 is read without a day"}
    ${"2026-10[u-ca=gregory]"}                | ${"only iso8601 is read without a day"}
    ${"2026-10[U-CA=iso8601]"}                | ${"AnnotationKey is lower case"}
    ${"2026-10[u-ca=İSO8601]"}                | ${"U+0130 is outside the AnnotationValue grammar"}
    ${"2026-13"}                              | ${"month 13 is Temporal's own error"}
    ${"2026-10[u-ca=GREGORY][u-ca=ISO8601]"}  | ${"the first u-ca wins, and it is not iso8601"}
    ${"2026-10[!u-ca=ISO8601][u-ca=gregory]"} | ${"a second u-ca after a critical one"}
    ${"-271821-03[u-ca=ISO8601]"}             | ${"range error survives the rewrite"}
    ${"+275760-10[u-ca=ISO8601]"}             | ${"range error survives the rewrite"}
  `("throws RangeError for '$value' ($why)", ({ value }: { value: string }) => {
    expect(() => yearMonthFrom(value)).toThrow(RangeError);
  });
});
