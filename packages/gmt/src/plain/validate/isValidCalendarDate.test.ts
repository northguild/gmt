import { isValidCalendarDate } from "./isValidCalendarDate";

describe("isValidCalendarDate", () => {
  it.each`
    value
    ${"2024-02-29"}
    ${"2024-10-03"}
    ${"2024-10-03[u-ca=hebrew]"}
    ${"2024-02-10[u-ca=hebrew]"}
    ${"2024-10-03[u-ca=islamic-civil]"}
    ${"2024-10-03[u-ca=islamic-tbla]"}
    ${"2024-10-03[u-ca=islamic-umalqura]"}
    ${"2024-10-03[u-ca=japanese]"}
    ${"2024-10-03[u-ca=buddhist]"}
    ${"2024-10-03[u-ca=roc]"}
    ${"2024-10-03[u-ca=persian]"}
    ${"2024-10-03[u-ca=indian]"}
    ${"2024-10-03[u-ca=ethiopic]"}
    ${"2024-10-03[u-ca=ethioaa]"}
    ${"2024-10-03[u-ca=coptic]"}
    ${"2024-10-03[u-ca=gregory]"}
    ${"2024-10-03[u-ca=iso8601]"}
    ${"2024-10-03[!u-ca=hebrew]"}
    ${"2024-10-03[u-ca=HEBREW]"}
    ${"2024-10-03[u-ca=ethiopic-amete-alem]"}
    ${"2024-10-03[u-ca=islamicc]"}
    ${"+002024-10-03[u-ca=roc]"}
    ${"5785-01-01[u-ca=hebrew]"}
    ${"2024-10-03[u-ca=hebrew][u-ca=roc]"}
    ${"2024-10-03[Asia/Tokyo][u-ca=hebrew]"}
    ${"2024-10-03[foo=bar][u-ca=hebrew]"}
    ${"2024-10-03[u-ca=hebrew][foo=bar]"}
    ${"2024-10-03[Asia/Tokyo]"}
  `(
    "returns true for valid calendar date: $value",
    ({ value }: { value: string }) => {
      expect(isValidCalendarDate(value)).toBe(true);
    },
  );

  // The TC39 PlainDate maximum, +275760-09-13 (test262 extreme-dates.js), in every calendar, and the
  // CORE-6 near-limit window dates.
  it.each`
    value                                     | source
    ${"+275760-09-13[u-ca=hebrew]"}           | ${"test262 max"}
    ${"+275760-09-08[u-ca=hebrew]"}           | ${"Chromium 152, max - 5 d"}
    ${"+275760-05-16[u-ca=hebrew]"}           | ${"Chromium 152, max - 120 d (M05L)"}
    ${"+275760-09-13[u-ca=buddhist]"}         | ${"test262 max"}
    ${"+275760-08-13[u-ca=buddhist]"}         | ${"Chromium 152, max - 31 d"}
    ${"+275760-09-13[u-ca=islamic-civil]"}    | ${"test262 max"}
    ${"+275760-09-05[u-ca=islamic-civil]"}    | ${"Chromium 152, max - 8 d"}
    ${"+275760-09-13[u-ca=islamic-tbla]"}     | ${"test262 max"}
    ${"+275760-09-13[u-ca=islamic-umalqura]"} | ${"test262 max"}
    ${"+275760-09-13[u-ca=persian]"}          | ${"test262 max"}
    ${"+275760-09-13[u-ca=indian]"}           | ${"test262 max"}
    ${"+275760-09-13[u-ca=japanese]"}         | ${"test262 max"}
    ${"+275760-09-13[u-ca=roc]"}              | ${"test262 max (roc)"}
    ${"+275760-09-13[u-ca=ethioaa]"}          | ${"test262 max (ethioaa)"}
    ${"+275760-09-13[u-ca=coptic]"}           | ${"test262 max"}
    ${"+275760-09-13[u-ca=ethiopic]"}         | ${"test262 max"}
  `(
    "returns true for the range-limit calendar date $value ($source)",
    ({ value }: { value: string }) => {
      expect(isValidCalendarDate(value)).toBe(true);
    },
  );

  // One day past either limit is outside ISODateWithinLimits.
  it.each`
    value
    ${"+275760-09-14[u-ca=hebrew]"}
    ${"+275760-09-14[u-ca=islamic-civil]"}
    ${"-271821-04-18[u-ca=buddhist]"}
  `(
    "returns false for $value, one day past a limit",
    ({ value }: { value: string }) => {
      expect(isValidCalendarDate(value)).toBe(false);
    },
  );

  it.each`
    value                                                         | reason
    ${"2024-02-30"}                                               | ${"invalid ISO date"}
    ${"2023-02-29[u-ca=hebrew]"}                                  | ${"ISO 2023-02-29 does not exist, whatever the calendar"}
    ${"2024-13-01[u-ca=hebrew]"}                                  | ${"ISO month 13"}
    ${"2024-10-03[u-ca=martian]"}                                 | ${"unknown calendar"}
    ${"not-a-date"}                                               | ${"not a date"}
    ${""}                                                         | ${"empty"}
    ${"0006-10-03[u-ca=japanese;era=reiwa]"}                      | ${"';era=' is not RFC 9557 syntax"}
    ${"2017-01-23[u-ca=ethiopic;era=ethiopic]"}                   | ${"';era=' is not RFC 9557 syntax"}
    ${"279517-10-11[u-ca=hebrew]"}                                | ${"six-digit unsigned year"}
    ${"-0911-01-01[u-ca=roc]"}                                    | ${"four-digit signed year"}
    ${"-000000-01-01[u-ca=roc]"}                                  | ${"negative zero year"}
    ${"2024-10-03[U-CA=hebrew]"}                                  | ${"upper-case annotation key"}
    ${"2024-10-03[!foo=bar][u-ca=hebrew]"}                        | ${"unknown critical annotation"}
    ${"2024-10-03[u-ca=hebrew][!u-ca=roc]"}                       | ${"critical second calendar annotation"}
    ${"2024-10-03[u-ca=chinese][u-ca=hebrew]"}                    | ${"the first calendar is one GMT does not support"}
    ${"2024-10-03[u-ca=hebrew][Asia/Tokyo]"}                      | ${"time zone annotation after the calendar"}
    ${"2024-10-03T00:00Z[u-ca=hebrew]"}                           | ${"a date-time with a UTC designator"}
    ${"2024-10-03T24:00[u-ca=hebrew]"}                            | ${"hour 24"}
    ${"2024-10-03T23:59:60[u-ca=hebrew]"}                         | ${"leap second, as every GMT Plain date-time input rejects it"}
    ${"20241003[u-ca=hebrew]"}                                    | ${"basic format, which isValidDate rejects"}
    ${"20241003T143000[u-ca=hebrew]"}                             | ${"basic format date-time, which isValidDateTime rejects"}
    ${"2024-10-03 14:30[u-ca=hebrew]"}                            | ${"space separator, which isValidDateTime rejects"}
    ${"2024-10-03t14:30[u-ca=hebrew]"}                            | ${"lower-case t separator, which isValidDateTime rejects"}
    ${"2024-10-03T14:30+01:00[u-ca=hebrew]"}                      | ${"UTC offset, which isValidDateTime rejects"}
    ${"2024-10-03T14:30:00-05:00[America/New_York][u-ca=hebrew]"} | ${"UTC offset before the time zone annotation"}
  `(
    "returns false for invalid calendar date: $value ($reason)",
    ({ value }: { value: string }) => {
      expect(isValidCalendarDate(value)).toBe(false);
    },
  );

  // A date-time is valid and names its date, as `Temporal.PlainDate.from` reads it (decided
  // 2026-09-17). Each accepted by native Chromium 153 and polyfill 0.5.1.
  it.each`
    value                                                   | reason
    ${"2024-10-03T00:00[u-ca=hebrew]"}                      | ${"calendar-annotated date-time"}
    ${"2024-10-03T14:30:00"}                                | ${"bare date-time (iso8601)"}
    ${"2024-10-03T14:30:00[America/New_York][u-ca=hebrew]"} | ${"time zone annotation ignored"}
  `("returns true for the date-time $value ($reason)", ({ value }) => {
    expect(isValidCalendarDate(value)).toBe(true);
  });

  // The calendar must be one GMT supports: Temporal knows these ids (or GMT used to), GMT does not
  // support them.
  it.each`
    value                                 | reason
    ${"2024-10-03[u-ca=islamic]"}         | ${"not in the proposal's calendar table"}
    ${"2024-10-03[u-ca=islamic-rgsa]"}    | ${"not in the proposal's calendar table"}
    ${"2024-10-03[u-ca=chinese]"}         | ${"not supported by GMT"}
    ${"2024-10-03[u-ca=dangi]"}           | ${"not supported by GMT"}
    ${"2024-10-03[u-ca=gregorian]"}       | ${"CLDR alias Temporal does not accept"}
    ${"2024-10-03[u-ca=taiwan]"}          | ${"pre-1.16.0 GMT id"}
    ${"2024-10-03[u-ca=islamic-tabular]"} | ${"pre-1.16.0 GMT id"}
  `(
    "returns false for the unsupported calendar id in $value ($reason)",
    ({ value }) => {
      expect(isValidCalendarDate(value)).toBe(false);
    },
  );

  // test262 intl402/Temporal/PlainDate/from/extreme-dates.js: the Umm al-Qura table's first and last
  // non-approximated dates, 1300-M01-01 and 1500-M12-30 (era "ah"), read back unchanged.
  it.each`
    value
    ${"1882-11-12[u-ca=islamic-umalqura]"}
    ${"2077-11-16[u-ca=islamic-umalqura]"}
  `(
    "returns true for the non-approximated Umm al-Qura date $value (test262)",
    ({ value }: { value: string }) => {
      expect(isValidCalendarDate(value)).toBe(true);
    },
  );

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
  `(
    "returns false for non-string input: $value",
    ({ value }: { value: unknown }) => {
      expect(isValidCalendarDate(value as string)).toBe(false);
    },
  );
});
