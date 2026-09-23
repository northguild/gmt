import { convertDateToCalendar } from "../plain/convert";
import { MustTestCalendars } from "../test";
import { calendarDate } from "./calendar-date";
import { calendarZonedDateTime } from "./calendar-zoned-date-time";

describe("calendarZonedDateTime regex", () => {
  // RFC 9557 §4.1 / Temporal: <date>T<time><offset>[<timeZone>][u-ca=<id>] — the calendar
  // annotation follows the time zone annotation. The date half is byte-identical to calendarDate's.
  it.each`
    value                                                                           | year         | month   | day     | time                    | offset       | timeZone                | critical     | calendarId
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]"}                   | ${"2024"}    | ${"02"} | ${"24"} | ${"14:30:00"}           | ${"-05:00"}  | ${"America/New_York"}   | ${undefined} | ${"hebrew"}
    ${"2019-04-30T12:00:00+09:00[Asia/Tokyo][u-ca=japanese]"}                       | ${"2019"}    | ${"04"} | ${"30"} | ${"12:00:00"}           | ${"+09:00"}  | ${"Asia/Tokyo"}         | ${undefined} | ${"japanese"}
    ${"2024-10-03T14:30Z[UTC][u-ca=buddhist]"}                                      | ${"2024"}    | ${"10"} | ${"03"} | ${"14:30"}              | ${"Z"}       | ${"UTC"}                | ${undefined} | ${"buddhist"}
    ${"2024-10-03T14:30:45.123456789+05:45[Asia/Kathmandu][u-ca=islamic-umalqura]"} | ${"2024"}    | ${"10"} | ${"03"} | ${"14:30:45.123456789"} | ${"+05:45"}  | ${"Asia/Kathmandu"}     | ${undefined} | ${"islamic-umalqura"}
    ${"2024-10-03T00:00:00[Africa/Addis_Ababa][u-ca=ethiopic]"}                     | ${"2024"}    | ${"10"} | ${"03"} | ${"00:00:00"}           | ${undefined} | ${"Africa/Addis_Ababa"} | ${undefined} | ${"ethiopic"}
    ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12][u-ca=hebrew]"}                      | ${"-271821"} | ${"04"} | ${"19"} | ${"12:00:00"}           | ${"-12:00"}  | ${"Etc/GMT+12"}         | ${undefined} | ${"hebrew"}
    ${"+275760-09-13T00:00:00+00:00[UTC][u-ca=roc]"}                                | ${"+275760"} | ${"09"} | ${"13"} | ${"00:00:00"}           | ${"+00:00"}  | ${"UTC"}                | ${undefined} | ${"roc"}
    ${"2024-10-03T14:30:00-04:00[America/New_York][!u-ca=hebrew]"}                  | ${"2024"}    | ${"10"} | ${"03"} | ${"14:30:00"}           | ${"-04:00"}  | ${"America/New_York"}   | ${"!"}       | ${"hebrew"}
    ${"2024-10-03T14:30:00-04:00[!America/New_York][u-ca=hebrew]"}                  | ${"2024"}    | ${"10"} | ${"03"} | ${"14:30:00"}           | ${"-04:00"}  | ${"!America/New_York"}  | ${undefined} | ${"hebrew"}
  `(
    "captures year $year month $month day $day time $time offset $offset zone $timeZone critical $critical calendar $calendarId from $value",
    ({
      value,
      year,
      month,
      day,
      time,
      offset,
      timeZone,
      critical,
      calendarId,
    }) => {
      const match = calendarZonedDateTime.exec(value);
      expect(match).not.toBeNull();
      expect(match?.slice(1)).toEqual([
        year,
        month,
        day,
        time,
        offset,
        timeZone,
        critical,
        calendarId,
      ]);
    },
  );

  it.each`
    value                                                                   | reason
    ${"2024-10-03T14:30:00-04:00[u-ca=hebrew][America/New_York]"}           | ${"calendar before zone: not RFC 9557 order (Temporal rejects it)"}
    ${"0031-04-30T12:00:00+09:00[Asia/Tokyo][u-ca=japanese;era=heisei]"}    | ${"';era=' is not RFC 9557 syntax"}
    ${"2024-10-03T14:30:00-04:00[u-ca=hebrew]"}                             | ${"no time zone segment"}
    ${"2024-10-03[u-ca=hebrew]"}                                            | ${"plain calendar date, no time or zone"}
    ${"2024-10-03T14:30:00-04:00[America/New_York]"}                        | ${"bare ISO zoned string, no annotation"}
    ${"2024-10-03T14:30:00-04:00[America/New_York][u-ca=hebrew]extra"}      | ${"trailing characters"}
    ${"2024-6-15T14:30:00-04:00[America/New_York][u-ca=hebrew]"}            | ${"unpadded month"}
    ${"2024-10-03 14:30:00-04:00[America/New_York][u-ca=hebrew]"}           | ${"space instead of T separator"}
    ${"2024-10-03T18:30:00z[America/New_York][u-ca=hebrew]"}                | ${"lower-case z designator (strict extended shape)"}
    ${"2024-10-03T14:30:00-04:00[][u-ca=hebrew]"}                           | ${"empty time zone segment"}
    ${"-000000-01-01T00:00:00+08:00[Asia/Taipei][u-ca=roc]"}                | ${"negative zero year"}
    ${"-0911-01-01T00:00:00+08:00[Asia/Taipei][u-ca=roc]"}                  | ${"four-digit signed year"}
    ${"279517-10-11T00:00:00+00:00[UTC][u-ca=hebrew]"}                      | ${"six-digit unsigned year"}
    ${"2024-10-03T14:30:00-04:00[America/New_York][U-CA=hebrew]"}           | ${"upper-case annotation key"}
    ${"2024-10-03T14:30:00-04:00[America/New_York][u-ca=hebrew][u-ca=roc]"} | ${"a second calendar annotation"}
  `("does not match $value ($reason)", ({ value }) => {
    expect(calendarZonedDateTime.test(value)).toBe(false);
  });

  // The zoned grammar's date half and annotation are the same groups as `calendarDate`'s. This
  // takes `convertDateToCalendar`'s real output for every supported non-ISO calendar, splices a
  // time, offset and zone between the date and the annotation, and requires a match.
  it.each(
    Object.values(MustTestCalendars)
      .filter((calendar) => calendar !== "iso8601")
      .map((calendar) => ({ calendar })),
  )(
    "matches the spliced convertDateToCalendar output for $calendar",
    ({ calendar }) => {
      const plain = convertDateToCalendar("2024-10-03", calendar);
      expect(calendarDate.test(plain)).toBe(true);

      const [datePart, annotation] = plain.split("[");
      const zoned = `${datePart}T12:00:00+00:00[UTC][${annotation}`;
      const match = calendarZonedDateTime.exec(zoned);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe("2024");
      expect(match?.[6]).toBe("UTC");
      expect(match?.[8]).toBe(calendar);
    },
  );

  it("does not match iso8601's bare output, which carries no annotation", () => {
    expect(convertDateToCalendar("2024-10-03", "iso8601")).toBe("2024-10-03");
    expect(calendarZonedDateTime.test("2024-10-03T12:00:00+00:00[UTC]")).toBe(
      false,
    );
  });
});
