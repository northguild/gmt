import { convertDateToCalendar } from "../plain/convert";
import { MustTestCalendars } from "../test";
import { calendarDate } from "./calendar-date";
import { calendarZonedDateTime } from "./calendar-zoned-date-time";

describe("calendarZonedDateTime regex", () => {
  it.each`
    value                                                                           | year      | month   | day     | time                    | offset       | calendarId               | era           | timeZone
    ${"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"}                   | ${"5784"} | ${"06"} | ${"15"} | ${"14:30:00"}           | ${"-05:00"}  | ${"hebrew"}              | ${undefined}  | ${"America/New_York"}
    ${"0031-04-30T12:00:00+09:00[u-ca=japanese;era=heisei][Asia/Tokyo]"}            | ${"0031"} | ${"04"} | ${"30"} | ${"12:00:00"}           | ${"+09:00"}  | ${"japanese"}            | ${"heisei"}   | ${"Asia/Tokyo"}
    ${"7517-12-30T00:30:00-04:00[u-ca=ethiopic-amete-alem][America/Santiago]"}      | ${"7517"} | ${"12"} | ${"30"} | ${"00:30:00"}           | ${"-04:00"}  | ${"ethiopic-amete-alem"} | ${undefined}  | ${"America/Santiago"}
    ${"2567-10-03T14:30Z[u-ca=buddhist][UTC]"}                                      | ${"2567"} | ${"10"} | ${"03"} | ${"14:30"}              | ${"Z"}       | ${"buddhist"}            | ${undefined}  | ${"UTC"}
    ${"1446-03-30T14:30:45.123456789+05:45[u-ca=islamic-umalqura][Asia/Kathmandu]"} | ${"1446"} | ${"03"} | ${"30"} | ${"14:30:45.123456789"} | ${"+05:45"}  | ${"islamic-umalqura"}    | ${undefined}  | ${"Asia/Kathmandu"}
    ${"2017-01-23T00:00:00[u-ca=ethiopic;era=ethiopic][Africa/Addis_Ababa]"}        | ${"2017"} | ${"01"} | ${"23"} | ${"00:00:00"}           | ${undefined} | ${"ethiopic"}            | ${"ethiopic"} | ${"Africa/Addis_Ababa"}
    ${"5784-13-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"}                   | ${"5784"} | ${"13"} | ${"15"} | ${"14:30:00"}           | ${"-05:00"}  | ${"hebrew"}              | ${undefined}  | ${"America/New_York"}
  `(
    "captures year $year month $month day $day time $time offset $offset calendar $calendarId era $era zone $timeZone from $value",
    ({ value, year, month, day, time, offset, calendarId, era, timeZone }) => {
      const match = calendarZonedDateTime.exec(value);
      expect(match).not.toBeNull();
      expect(match?.slice(1)).toEqual([
        year,
        month,
        day,
        time,
        offset,
        calendarId,
        era,
        timeZone,
      ]);
    },
  );

  it.each`
    value                                                                   | reason
    ${"2024-03-10T14:30:00-04:00[America/New_York][u-ca=hebrew]"}           | ${"Temporal's RFC 9557 segment ordering"}
    ${"5784-06-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"}           | ${"GMT digits in RFC 9557 ordering (the misparse hazard)"}
    ${"5784-06-15T14:30:00-05:00[u-ca=hebrew]"}                             | ${"no time zone segment"}
    ${"5784-06-15[u-ca=hebrew]"}                                            | ${"plain calendar date, no time or zone"}
    ${"2024-03-10T14:30:00-04:00[America/New_York]"}                        | ${"bare ISO zoned string, no annotation"}
    ${"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]extra"}      | ${"trailing characters"}
    ${"5784-06-15T14:30:00-05:00[u-ca=Hebrew][America/New_York]"}           | ${"uppercase calendar identifier"}
    ${"5784-06-15T14:30:00-05:00[u-ca=hebrew;era=REIWA][America/New_York]"} | ${"uppercase era identifier"}
    ${"5784-6-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"}            | ${"unpadded month"}
    ${"5784-06-15 14:30:00-05:00[u-ca=hebrew][America/New_York]"}           | ${"space instead of T separator"}
    ${"5784-06-15T14:30:00-05:00[u-ca=hebrew][]"}                           | ${"empty time zone segment"}
  `("does not match $value ($reason)", ({ value }) => {
    expect(calendarZonedDateTime.test(value)).toBe(false);
  });

  // DoD-10 regex sync: the zoned grammar's date half and annotation half are byte-identical to
  // `calendarDate`'s by construction. This test fails loudly if the two ever drift apart — it
  // takes `convertDateToCalendar`'s REAL output for every supported calendar, splices a time,
  // offset and zone into it, and requires the zoned regex to match the result.
  it.each(
    Object.values(MustTestCalendars)
      .filter((calendar) => calendar !== "gregorian")
      .map((calendar) => ({ calendar })),
  )(
    "matches the spliced convertDateToCalendar output for $calendar",
    ({ calendar }) => {
      const plain = convertDateToCalendar("2024-10-03", calendar);
      expect(calendarDate.test(plain)).toBe(true);

      const [datePart, annotation] = plain.split("[");
      const zoned = `${datePart}T12:00:00+00:00[${annotation}[UTC]`;
      const match = calendarZonedDateTime.exec(zoned);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe(datePart.split("-")[0]);
      expect(match?.[8]).toBe("UTC");
    },
  );

  it("matches gregorian's bare output only once a calendar annotation is spliced in", () => {
    expect(convertDateToCalendar("2024-10-03", "gregorian")).toBe("2024-10-03");
    expect(calendarZonedDateTime.test("2024-10-03T12:00:00+00:00[UTC]")).toBe(
      false,
    );
  });
});
