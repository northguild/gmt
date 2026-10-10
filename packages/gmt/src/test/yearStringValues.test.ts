/**
 * How a year is written, by every function that writes one.
 *
 * A year is written as Temporal writes it (TC39 Temporal `PadISOYear ( y )`, §3.5.10): four digits
 * from 0000 to 9999, otherwise a sign and six digits. That holds at the head of a date or
 * date-time string and for a year returned on its own. Written any other way (`"10000-06-15"`,
 * `"00-5-06-15"`, `"5"`) the text is not an ISO 8601 year, and neither Temporal nor the library's
 * own validators read it in a date. So each row checks three things: the value, that the
 * library's own validator accepts it in a date, and that Temporal reads the same year back.
 *
 * The years are Temporal's first and last (-271821, 275760), each side of the four-digit range
 * (-5, 0, 1, 9999, 10000) and, for a year on its own, the ones that need padding (5, 999) beside
 * the first that does not (1000). Every clock and instant is 12:00:00Z on 15 June, which is
 * inside the instant range in the first and last years too.
 */
import { Temporal } from "@js-temporal/polyfill";
import { getNowUnit } from "../plain/get/getNowUnit";
import { getToday } from "../plain/get/getToday";
import { getYear } from "../plain/get/getYear";
import { mapDaysInMonth } from "../plain/map/mapDaysInMonth";
import { isValidDate } from "../plain/validate/isValidDate";
import { isValidDateTime } from "../plain/validate/isValidDateTime";
import { convertUnixToPlainDate } from "../unix/convert/convertUnixToPlainDate";
import { convertUnixToPlainDateTime } from "../unix/convert/convertUnixToPlainDateTime";
import { getUnixNowUnit } from "../unix/get/getUnixNowUnit";
import { getUnixYear } from "../unix/get/getUnixYear";
import { parseUnitFromDate } from "../plain/parse/parseUnitFromDate";
import { parseUnitFromDateTime } from "../plain/parse/parseUnitFromDateTime";
import { parseYearFromDate } from "../plain/parse/parseYearFromDate";
import { parseYearFromDateTime } from "../plain/parse/parseYearFromDateTime";
import { parseUnitFromZoned } from "../zoned/parse/parseUnitFromZoned";
import { parseYearFromZoned } from "../zoned/parse/parseYearFromZoned";
import { parseDateFromUnix } from "../unix/parse/parseDateFromUnix";
import { parseUnitFromUnix } from "../unix/parse/parseUnitFromUnix";
import { parseYearFromUnix } from "../unix/parse/parseYearFromUnix";
import { convertUtcToPlainDate } from "../utc/convert/convertUtcToPlainDate";
import { convertUtcToPlainDateTime } from "../utc/convert/convertUtcToPlainDateTime";
import { getUtcNowUnit } from "../utc/get/getUtcNowUnit";
import { getUtcYear } from "../utc/get/getUtcYear";
import { parseDateFromUtc } from "../utc/parse/parseDateFromUtc";
import { parseUnitFromUtc } from "../utc/parse/parseUnitFromUtc";
import { parseYearFromUtc } from "../utc/parse/parseYearFromUtc";
import * as getSystemTimeZoneModule from "../zoned/get/getSystemTimeZone";
import { getZonedNowUnit } from "../zoned/get/getZonedNowUnit";
import { getZonedToday } from "../zoned/get/getZonedToday";
import { getZonedYear } from "../zoned/get/getZonedYear";

/** 12:00:00Z on 15 June of `year`, built by plain Temporal from the year as a number. */
function midYear(year: number): Temporal.Instant {
  return Temporal.PlainDateTime.from({ year, month: 6, day: 15, hour: 12 })
    .toZonedDateTime("UTC")
    .toInstant();
}

describe("how a year is written", () => {
  /**
   * Pin the clock to mid-year and the system zone to UTC, for the readers of "now". Noon is a
   * different date in a host zone twelve or more hours from UTC, so the system zone is not left
   * to the host.
   */
  function pinClock(year: number): void {
    vi.useFakeTimers();
    vi.setSystemTime(midYear(year).epochMilliseconds);
    vi.spyOn(getSystemTimeZoneModule, "getSystemTimeZone").mockReturnValue(
      "UTC",
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each`
    year       | written
    ${-271821} | ${"-271821"}
    ${-5}      | ${"-000005"}
    ${0}       | ${"0000"}
    ${1}       | ${"0001"}
    ${9999}    | ${"9999"}
    ${10000}   | ${"+010000"}
    ${275760}  | ${"+275760"}
  `(
    "year $year is written $written at the head of every date and date-time",
    ({ year, written }: { year: number; written: string }) => {
      const instant = midYear(year);
      const utc = instant.toString();
      const ms = instant.epochMilliseconds;
      const date = `${written}-06-15`;
      const dateTime = `${written}-06-15T12:00:00`;
      pinClock(year);

      // The table's spelling is Temporal's own.
      expect(utc).toBe(`${dateTime}Z`);

      const dates = {
        convertUtcToPlainDate: convertUtcToPlainDate(utc),
        parseDateFromUtc: parseDateFromUtc(utc),
        convertUnixToPlainDate: convertUnixToPlainDate(ms),
        parseDateFromUnix: parseDateFromUnix(ms),
        getZonedToday: getZonedToday("UTC"),
        getToday: getToday(),
      };
      const dateTimes = {
        convertUtcToPlainDateTime: convertUtcToPlainDateTime(utc),
        convertUnixToPlainDateTime: convertUnixToPlainDateTime(ms),
      };

      expect(dates).toEqual({
        convertUtcToPlainDate: date,
        parseDateFromUtc: date,
        convertUnixToPlainDate: date,
        parseDateFromUnix: date,
        getZonedToday: date,
        getToday: date,
      });
      expect(dateTimes).toEqual({
        convertUtcToPlainDateTime: dateTime,
        convertUnixToPlainDateTime: dateTime,
      });
      expect(isValidDate(date)).toBe(true);
      expect(isValidDateTime(dateTime)).toBe(true);
      expect(Temporal.PlainDate.from(date).year).toBe(year);
      expect(Temporal.PlainDateTime.from(dateTime).year).toBe(year);
    },
  );

  it.each`
    year       | written
    ${-271821} | ${"-271821"}
    ${-5}      | ${"-000005"}
    ${0}       | ${"0000"}
    ${1}       | ${"0001"}
    ${9999}    | ${"9999"}
    ${10000}   | ${"+010000"}
    ${275760}  | ${"+275760"}
  `(
    "the four current-year readers return $written in year $year, the head of a date Temporal reads",
    ({ year, written }: { year: number; written: string }) => {
      pinClock(year);

      expect({
        getYear: getYear(),
        getUtcYear: getUtcYear(),
        getUnixYear: getUnixYear(),
        getZonedYear: getZonedYear("UTC"),
        getZonedYearAtStoredOffset: getZonedYear("-00:44:30"),
      }).toEqual({
        getYear: written,
        getUtcYear: written,
        getUnixYear: written,
        getZonedYear: written,
        getZonedYearAtStoredOffset: written,
      });
      expect(isValidDate(`${written}-06-15`)).toBe(true);
      expect(Temporal.PlainDate.from(`${written}-06-15`).year).toBe(year);
    },
  );

  // A year on its own: the `parseYearFrom…` functions, the "year" unit of every
  // `parseUnitFrom…` function and of every `get…NowUnit` reader. Expected values are PadISOYear,
  // worked by hand; `<year>-06-15` must be the date Temporal writes and reads.
  it.each`
    year       | written
    ${-271821} | ${"-271821"}
    ${-5}      | ${"-000005"}
    ${0}       | ${"0000"}
    ${1}       | ${"0001"}
    ${5}       | ${"0005"}
    ${999}     | ${"0999"}
    ${1000}    | ${"1000"}
    ${2024}    | ${"2024"}
    ${9999}    | ${"9999"}
    ${10000}   | ${"+010000"}
    ${275760}  | ${"+275760"}
  `(
    "every reader of a year on its own returns $written in year $year, the head of a date Temporal reads",
    ({ year, written }: { year: number; written: string }) => {
      const instant = midYear(year);
      const utc = instant.toString();
      const ms = instant.epochMilliseconds;
      const zoned = instant.toZonedDateTimeISO("UTC").toString();
      const date = `${written}-06-15`;
      const dateTime = `${date}T12:00:00`;
      pinClock(year);

      // The table's spelling is Temporal's own.
      expect(
        Temporal.PlainDate.from({ year, month: 6, day: 15 }).toString(),
      ).toBe(date);

      expect({
        parseYearFromDate: parseYearFromDate(date),
        parseUnitFromDate: parseUnitFromDate(date, "year"),
        parseYearFromDateTime: parseYearFromDateTime(dateTime),
        parseUnitFromDateTime: parseUnitFromDateTime(dateTime, "year"),
        parseYearFromZoned: parseYearFromZoned(zoned),
        parseUnitFromZoned: parseUnitFromZoned(zoned, "year"),
        parseYearFromUtc: parseYearFromUtc(utc),
        parseUnitFromUtc: parseUnitFromUtc(utc, "year"),
        parseUnitFromUtcPlural: parseUnitFromUtc(utc, "years"),
        parseYearFromUnix: parseYearFromUnix(ms),
        parseUnitFromUnix: parseUnitFromUnix(ms, "year"),
        parseUnitFromUnixAtStoredOffset: parseUnitFromUnix(ms, "year", {
          timeZone: "-00:44:30",
        }),
        getNowUnit: getNowUnit("year"),
        getUtcNowUnit: getUtcNowUnit("year"),
        getUnixNowUnit: getUnixNowUnit("year"),
        getZonedNowUnit: getZonedNowUnit("UTC", "year"),
        getZonedNowUnitPlural: getZonedNowUnit("UTC", "years"),
      }).toEqual({
        parseYearFromDate: written,
        parseUnitFromDate: written,
        parseYearFromDateTime: written,
        parseUnitFromDateTime: written,
        parseYearFromZoned: written,
        parseUnitFromZoned: written,
        parseYearFromUtc: written,
        parseUnitFromUtc: written,
        parseUnitFromUtcPlural: written,
        parseYearFromUnix: written,
        parseUnitFromUnix: written,
        parseUnitFromUnixAtStoredOffset: written,
        getNowUnit: written,
        getUtcNowUnit: written,
        getUnixNowUnit: written,
        getZonedNowUnit: written,
        getZonedNowUnitPlural: written,
      });
      expect(isValidDate(date)).toBe(true);
      expect(Temporal.PlainDate.from(date).year).toBe(year);
    },
  );

  // Only the year changed form. In year 5 every other unit reads as it always did: two digits,
  // three for the parts of a second, and the day of the week and the week number unpadded.
  // 15 June of year 5 is a Wednesday in ISO week 24.
  it.each`
    unit             | expected
    ${"month"}       | ${"06"}
    ${"week"}        | ${"24"}
    ${"day"}         | ${"15"}
    ${"dayOfWeek"}   | ${"3"}
    ${"hour"}        | ${"12"}
    ${"minute"}      | ${"00"}
    ${"second"}      | ${"00"}
    ${"millisecond"} | ${"000"}
  `(
    "the $unit of 0005-06-15T12:00:00 is still $expected in every parseUnitFrom… function",
    ({ unit, expected }) => {
      const instant = midYear(5);

      expect({
        parseUnitFromDateTime: parseUnitFromDateTime(
          "0005-06-15T12:00:00",
          unit,
        ),
        parseUnitFromZoned: parseUnitFromZoned(
          "0005-06-15T12:00:00+00:00[UTC]",
          unit,
        ),
        parseUnitFromUtc: parseUnitFromUtc(instant.toString(), unit),
        parseUnitFromUnix: parseUnitFromUnix(instant.epochMilliseconds, unit),
      }).toEqual({
        parseUnitFromDateTime: expected,
        parseUnitFromZoned: expected,
        parseUnitFromUtc: expected,
        parseUnitFromUnix: expected,
      });
    },
  );

  // The same for the readers of "now", with the clock at 12:00:00Z on Saturday 15 June 2024, ISO
  // week 24. (Before 1970 the polyfill's clock runs a fraction of a millisecond behind a pinned
  // time, so the hour of a pinned noon is not a fixed value there.)
  it.each`
    unit             | expected
    ${"year"}        | ${"2024"}
    ${"month"}       | ${"06"}
    ${"week"}        | ${"24"}
    ${"day"}         | ${"15"}
    ${"dayOfWeek"}   | ${"6"}
    ${"hour"}        | ${"12"}
    ${"minute"}      | ${"00"}
    ${"second"}      | ${"00"}
    ${"millisecond"} | ${"000"}
  `(
    "the $unit of the clock at 2024-06-15T12:00:00Z is still $expected in every get…NowUnit reader",
    ({ unit, expected }) => {
      pinClock(2024);

      expect({
        getNowUnit: getNowUnit(unit),
        getUtcNowUnit: getUtcNowUnit(unit),
        getUnixNowUnit: getUnixNowUnit(unit),
        getZonedNowUnit: getZonedNowUnit("UTC", unit),
      }).toEqual({
        getNowUnit: expected,
        getUtcNowUnit: expected,
        getUnixNowUnit: expected,
        getZonedNowUnit: expected,
      });
    },
  );

  // June has 30 days in every year. The input is the year-month as Temporal writes it.
  it.each`
    month           | year
    ${"-271821-06"} | ${-271821}
    ${"-000005-06"} | ${-5}
    ${"0000-06"}    | ${0}
    ${"0001-06"}    | ${1}
    ${"9999-06"}    | ${9999}
    ${"+010000-06"} | ${10000}
    ${"+275760-06"} | ${275760}
  `(
    "mapDaysInMonth lists the 30 days of $month, each a date isValidDate accepts",
    ({ month, year }: { month: string; year: number }) => {
      const days = mapDaysInMonth(month);

      expect(Temporal.PlainYearMonth.from({ year, month: 6 }).toString()).toBe(
        month,
      );
      expect(days).toHaveLength(30);
      expect(days[0]).toBe(`${month}-01`);
      expect(days[29]).toBe(`${month}-30`);
      expect(days.every((day) => isValidDate(day))).toBe(true);
      expect(days.map((day) => Temporal.PlainDate.from(day).year)).toEqual(
        Array.from({ length: 30 }, () => year),
      );
    },
  );

  it.each`
    month         | reason
    ${"10000-06"} | ${"five digits with no sign"}
    ${"-5-06"}    | ${"a negative year with no padding"}
    ${"00-5-06"}  | ${"a sign inside the padding"}
    ${"1-06"}     | ${"a year short of four digits"}
    ${"+2024-06"} | ${"a sign on four digits"}
  `("mapDaysInMonth returns [] for $month ($reason)", ({ month }) => {
    expect(mapDaysInMonth(month)).toEqual([]);
  });
});
