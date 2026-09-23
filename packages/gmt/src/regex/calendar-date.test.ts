import { calendarDate } from "./calendar-date";

describe("calendarDate regex", () => {
  // Temporal / RFC 9557: DateYear is DecimalDigit{4} or ASCIISign DecimalDigit{6} (not -000000),
  // then one [u-ca=<value>] annotation, optionally critical ([!u-ca=...]). AnnotationValue is
  // alphanumeric components joined by single hyphens, any case (CanonicalizeCalendar folds case).
  it.each`
    value                              | year         | month   | day     | critical     | calendarId
    ${"2024-10-03[u-ca=hebrew]"}       | ${"2024"}    | ${"10"} | ${"03"} | ${undefined} | ${"hebrew"}
    ${"0000-12-31[u-ca=roc]"}          | ${"0000"}    | ${"12"} | ${"31"} | ${undefined} | ${"roc"}
    ${"+275760-09-13[u-ca=hebrew]"}    | ${"+275760"} | ${"09"} | ${"13"} | ${undefined} | ${"hebrew"}
    ${"-271821-04-19[u-ca=hebrew]"}    | ${"-271821"} | ${"04"} | ${"19"} | ${undefined} | ${"hebrew"}
    ${"+002024-10-03[u-ca=japanese]"}  | ${"+002024"} | ${"10"} | ${"03"} | ${undefined} | ${"japanese"}
    ${"+000000-01-01[u-ca=gregory]"}   | ${"+000000"} | ${"01"} | ${"01"} | ${undefined} | ${"gregory"}
    ${"2024-10-03[!u-ca=hebrew]"}      | ${"2024"}    | ${"10"} | ${"03"} | ${"!"}       | ${"hebrew"}
    ${"2024-10-03[u-ca=islamic-tbla]"} | ${"2024"}    | ${"10"} | ${"03"} | ${undefined} | ${"islamic-tbla"}
    ${"2024-10-03[u-ca=HEBREW]"}       | ${"2024"}    | ${"10"} | ${"03"} | ${undefined} | ${"HEBREW"}
    ${"2024-10-03[u-ca=iso8601]"}      | ${"2024"}    | ${"10"} | ${"03"} | ${undefined} | ${"iso8601"}
  `(
    "captures year $year month $month day $day critical $critical calendar $calendarId from $value",
    ({ value, year, month, day, critical, calendarId }) => {
      expect(calendarDate.exec(value)?.slice(1)).toEqual([
        year,
        month,
        day,
        critical,
        calendarId,
      ]);
    },
  );

  it.each`
    value                                    | reason
    ${"-000000-01-01[u-ca=roc]"}             | ${"negative zero is forbidden (Temporal DateYear early error)"}
    ${"-0911-01-01[u-ca=roc]"}               | ${"a signed year needs six digits"}
    ${"279517-10-11[u-ca=hebrew]"}           | ${"an unsigned year has exactly four digits"}
    ${"27951-10-11[u-ca=hebrew]"}            | ${"five-digit unsigned year"}
    ${"-1000000-01-01[u-ca=roc]"}            | ${"seven-digit signed year"}
    ${"911-01-01[u-ca=roc]"}                 | ${"three-digit year"}
    ${"2024-13-01[u-ca=hebrew]"}             | ${"ISO month 13 (the digits are ISO, not calendar-native)"}
    ${"2024-10-32[u-ca=hebrew]"}             | ${"ISO day 32"}
    ${"0006-10-03[u-ca=japanese;era=reiwa]"} | ${"';era=' is not RFC 9557 syntax"}
    ${"2024-10-03[U-CA=hebrew]"}             | ${"the annotation key is lower-case only"}
    ${"2024-10-03[u-ca=-hebrew]"}            | ${"value component starting with a hyphen"}
    ${"2024-10-03[u-ca=a--b]"}               | ${"value with a double hyphen"}
    ${"2024-10-03[u-ca=]"}                   | ${"empty value"}
    ${"2024-10-03[u-ca=hebrew][u-ca=roc]"}   | ${"a second annotation"}
    ${"2024-10-03[Asia/Tokyo][u-ca=hebrew]"} | ${"a time zone annotation on a date"}
    ${"2024-10-03T00:00:00[u-ca=hebrew]"}    | ${"a date-time, not a date"}
    ${"2024-10-03"}                          | ${"no calendar annotation"}
  `("does not match $value ($reason)", ({ value }) => {
    expect(calendarDate.test(value)).toBe(false);
  });
});
