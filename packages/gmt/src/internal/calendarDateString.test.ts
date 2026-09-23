import { parseCalendarDateValue } from "./calendarDateString";

describe("parseCalendarDateValue", () => {
  // RFC 9557: the digits are the ISO date whatever the annotation says, so every row names ISO
  // 2024-10-03. The calendar is the annotation's, canonicalized; "ethiopic" and "coptic" compute
  // in "ethioaa" (internal/calendarSystemIds.ts computationCalendarId).
  it.each`
    value                                  | expectedIso        | calendarId
    ${"2024-10-03"}                        | ${"2024-10-03"}    | ${"iso8601"}
    ${"2024-10-03[u-ca=iso8601]"}          | ${"2024-10-03"}    | ${"iso8601"}
    ${"2024-10-03[u-ca=gregory]"}          | ${"2024-10-03"}    | ${"gregory"}
    ${"2024-10-03[u-ca=hebrew]"}           | ${"2024-10-03"}    | ${"hebrew"}
    ${"2024-10-03[u-ca=islamic-civil]"}    | ${"2024-10-03"}    | ${"islamic-civil"}
    ${"2024-10-03[u-ca=islamic-tbla]"}     | ${"2024-10-03"}    | ${"islamic-tbla"}
    ${"2024-10-03[u-ca=islamic-umalqura]"} | ${"2024-10-03"}    | ${"islamic-umalqura"}
    ${"2024-10-03[u-ca=japanese]"}         | ${"2024-10-03"}    | ${"japanese"}
    ${"2024-10-03[u-ca=buddhist]"}         | ${"2024-10-03"}    | ${"buddhist"}
    ${"2024-10-03[u-ca=roc]"}              | ${"2024-10-03"}    | ${"roc"}
    ${"2024-10-03[u-ca=persian]"}          | ${"2024-10-03"}    | ${"persian"}
    ${"2024-10-03[u-ca=indian]"}           | ${"2024-10-03"}    | ${"indian"}
    ${"2024-10-03[u-ca=ethiopic]"}         | ${"2024-10-03"}    | ${"ethioaa"}
    ${"2024-10-03[u-ca=ethioaa]"}          | ${"2024-10-03"}    | ${"ethioaa"}
    ${"2024-10-03[u-ca=coptic]"}           | ${"2024-10-03"}    | ${"ethioaa"}
    ${"2024-10-03[!u-ca=hebrew]"}          | ${"2024-10-03"}    | ${"hebrew"}
    ${"2024-10-03[u-ca=HEBREW]"}           | ${"2024-10-03"}    | ${"hebrew"}
    ${"2024-10-03[u-ca=islamicc]"}         | ${"2024-10-03"}    | ${"islamic-civil"}
    ${"+275760-09-13[u-ca=hebrew]"}        | ${"+275760-09-13"} | ${"hebrew"}
    ${"-271821-04-19[u-ca=hebrew]"}        | ${"-271821-04-19"} | ${"hebrew"}
  `(
    "parses $value to ISO $expectedIso computed in $calendarId",
    ({ value, expectedIso, calendarId }) => {
      const date = parseCalendarDateValue(value);
      expect(date.withCalendar("iso8601").toString()).toBe(expectedIso);
      expect(date.calendarId).toBe(calendarId);
    },
  );

  // Temporal's annotation grammar (ParseISODateTime; native Chromium 153 agrees): a time zone
  // annotation on a date and elective unknown annotations are read and ignored, and the first
  // u-ca annotation names the calendar. "[x=y]" is a one-character key and value, valid in the
  // spec's Annotation grammar (Chromium 153 rejects it; the spec text is the authority).
  it.each`
    value                                      | calendarId
    ${"2024-10-03[Asia/Tokyo][u-ca=hebrew]"}   | ${"hebrew"}
    ${"2024-10-03[!Asia/Tokyo][u-ca=hebrew]"}  | ${"hebrew"}
    ${"2024-10-03[+09:00][u-ca=roc]"}          | ${"roc"}
    ${"2024-10-03[foo=bar][u-ca=hebrew]"}      | ${"hebrew"}
    ${"2024-10-03[u-ca=hebrew][foo=bar]"}      | ${"hebrew"}
    ${"2024-10-03[x=y][u-ca=roc]"}             | ${"roc"}
    ${"2024-10-03[u-ca=hebrew][u-ca=roc]"}     | ${"hebrew"}
    ${"2024-10-03[u-ca=hebrew][u-ca=chinese]"} | ${"hebrew"}
    ${"2024-10-03[u-ca=coptic][foo=bar]"}      | ${"ethioaa"}
    ${"2024-10-03[Asia/Tokyo]"}                | ${"iso8601"}
    ${"2024-10-03[foo=bar]"}                   | ${"iso8601"}
  `(
    "parses $value to ISO 2024-10-03 computed in $calendarId, ignoring the other annotations",
    ({ value, calendarId }) => {
      const date = parseCalendarDateValue(value);
      expect(date.withCalendar("iso8601").toString()).toBe("2024-10-03");
      expect(date.calendarId).toBe(calendarId);
    },
  );

  it.each`
    value                                       | reason
    ${"2024-10-03[!foo=bar][u-ca=hebrew]"}      | ${"unknown critical annotation"}
    ${"2024-10-03[u-ca=hebrew][!foo=bar]"}      | ${"unknown critical annotation after the calendar"}
    ${"2024-10-03[!u-ca=hebrew][u-ca=roc]"}     | ${"second calendar after a critical one"}
    ${"2024-10-03[u-ca=hebrew][!u-ca=roc]"}     | ${"critical second calendar"}
    ${"2024-10-03[!u-ca=hebrew][!u-ca=hebrew]"} | ${"repeated critical calendar"}
    ${"2024-10-03[u-ca=chinese][u-ca=hebrew]"}  | ${"the first calendar names one GMT does not support"}
    ${"2024-10-03[u-ca=hebrew][Asia/Tokyo]"}    | ${"time zone annotation after the calendar"}
    ${"2024-10-03[Asia/Tokyo][UTC]"}            | ${"two time zone annotations"}
    ${"2024-10-03[Foo=bar][u-ca=hebrew]"}       | ${"upper-case annotation key"}
    ${"2024-02-30"}                             | ${"ISO day 30 of February"}
    ${"2023-02-29[u-ca=hebrew]"}                | ${"ISO 2023 is not a leap year, whatever the calendar"}
    ${"2024-10-03[u-ca=martian]"}               | ${"unknown calendar"}
    ${"2024-10-03[u-ca=gregorian]"}             | ${"CLDR alias Temporal does not accept"}
    ${"2024-10-03[u-ca=taiwan]"}                | ${"pre-1.16.0 GMT name"}
    ${"2024-10-03[u-ca=islamic]"}               | ${"not in the proposal's calendar table"}
    ${"2024-10-03[u-ca=chinese]"}               | ${"not supported by GMT"}
    ${"0006-10-03[u-ca=japanese;era=reiwa]"}    | ${"';era=' is not RFC 9557 syntax"}
    ${"279517-10-11[u-ca=hebrew]"}              | ${"six-digit unsigned year"}
    ${"+275760-09-14[u-ca=hebrew]"}             | ${"past the maximum ISO date"}
    ${"-000000-01-01[u-ca=roc]"}                | ${"negative zero year"}
    ${"not-a-date"}                             | ${"not a date"}
  `("throws for $value ($reason)", ({ value }) => {
    expect(() => parseCalendarDateValue(value)).toThrow();
  });

  // A date-time is read as its date, as `Temporal.PlainDate.from` reads it (decided
  // 2026-09-17). Expected `toString()` values from native Chromium 153 (polyfill 0.5.1 agrees).
  it.each`
    value                                                   | expected
    ${"2024-03-10T14:30:00"}                                | ${"2024-03-10"}
    ${"2024-03-10T14:30:00[America/New_York]"}              | ${"2024-03-10"}
    ${"2024-03-10T14:30:00[u-ca=hebrew]"}                   | ${"2024-03-10[u-ca=hebrew]"}
    ${"2024-10-03T23:59:59.999999999[u-ca=hebrew]"}         | ${"2024-10-03[u-ca=hebrew]"}
    ${"2024-10-03T14:30:00[America/New_York][u-ca=hebrew]"} | ${"2024-10-03[u-ca=hebrew]"}
    ${"+275760-09-13T23:59[u-ca=roc]"}                      | ${"+275760-09-13[u-ca=roc]"}
  `(
    "reads the date-time $value as the date $expected",
    ({ value, expected }) => {
      expect(parseCalendarDateValue(value).toString()).toBe(expected);
    },
  );

  // Temporal rejects these date-times: a UTC designator on a Plain type, hour 24, an unknown
  // critical annotation, and a calendar GMT does not support. A leap second is rejected as every
  // GMT Plain date-time input rejects it (`isValidDateTime`, a duration `relativeTo`), although
  // Temporal would clamp it to :59.
  it.each`
    value                                        | reason
    ${"2024-10-03T14:30:00Z"}                    | ${"UTC designator"}
    ${"2024-10-03T14:30:00Z[u-ca=hebrew]"}       | ${"UTC designator"}
    ${"2024-10-03T24:00[u-ca=hebrew]"}           | ${"hour 24"}
    ${"2024-10-03T00:00[!foo=bar][u-ca=hebrew]"} | ${"unknown critical annotation"}
    ${"2024-10-03T00:00[u-ca=chinese]"}          | ${"not supported by GMT"}
    ${"2024-10-03T"}                             | ${"no time after T"}
    ${"2024-10-03T23:59:60[u-ca=hebrew]"}        | ${"leap second"}
    ${"2024-10-03 235960"}                       | ${"leap second, basic digits"}
  `("throws for the date-time $value ($reason)", ({ value }) => {
    expect(() => parseCalendarDateValue(value)).toThrow();
  });

  // GMT's strict shape before the first `[` (the house rule of `isValidDate`
  // and `isValidDateTime`): the extended date or date-time only. Native Chromium 153
  // `Temporal.PlainDate.from` accepts every one of these (basic format, a space or lower-case `t`
  // separator, a UTC offset); GMT rejects them, as `isValidDate`/`isValidDateTime` do.
  it.each`
    value                                                         | reason
    ${"20241003"}                                                 | ${"basic format date"}
    ${"20241003[u-ca=hebrew]"}                                    | ${"basic format date"}
    ${"20241003T143000[u-ca=hebrew]"}                             | ${"basic format date-time"}
    ${"2024-10-03T1430[u-ca=hebrew]"}                             | ${"basic format time"}
    ${"2024-10-03 14:30[u-ca=hebrew]"}                            | ${"space separator"}
    ${"2024-10-03t14:30[u-ca=hebrew]"}                            | ${"lower-case t separator"}
    ${"2024-10-03T14:30+01:00[u-ca=hebrew]"}                      | ${"UTC offset"}
    ${"2024-10-03T14:30:00-05:00[America/New_York][u-ca=hebrew]"} | ${"UTC offset before a time zone annotation"}
  `(
    "throws for $value ($reason), outside GMT's strict date or date-time shape",
    ({ value }) => {
      expect(() => parseCalendarDateValue(value)).toThrow();
    },
  );
});
