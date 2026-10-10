/**
 * What each family returns at a stored UTC offset with seconds, worked by hand.
 *
 * `./zoneArgument.test.ts` proves that an offset gives what its zone gives. This file states the
 * values themselves, so the answer does not rest on the named-zone path being right.
 *
 * Every row uses `-00:44:30` (Africa/Monrovia until 1972) unless it says otherwise. Local time is
 * the instant plus the offset (TC39 Temporal GetISODateTimeFor), so:
 *
 * - `12:44:30Z` is `12:00:00` local, and local midnight on 1 January 1970 is `00:44:30Z`, which is
 *   2 670 000 ms after the epoch.
 * - `00:30:00Z` is `23:45:30` local on the day before.
 *
 * Temporal's last instant is `+275760-09-13T00:00:00Z` (8.64e15 ms). The rows at that limit read
 * the local wall clock, which reaches a day past it.
 */
import { Temporal } from "@js-temporal/polyfill";
import { bucketRange } from "../calendar/calculate/bucketRange";
import { floorToZone } from "../calendar/calculate/floorToZone";
import { addOperatingTime } from "../calendar/hours/addOperatingTime";
import { isOpenAt } from "../calendar/hours/isOpenAt";
import { nextCloseAt } from "../calendar/hours/nextCloseAt";
import { nextOpenAt } from "../calendar/hours/nextOpenAt";
import { operatingIntervals } from "../calendar/hours/operatingIntervals";
import { operatingTimeBetween } from "../calendar/hours/operatingTimeBetween";
import { recurringWindows } from "../calendar/hours/recurringWindows";
import { chargeableDays } from "../intermodal/calculate/chargeableDays";
import { freeTimeExpiry } from "../intermodal/calculate/freeTimeExpiry";
import { bolTimestamp } from "../intermodal/format/bolTimestamp";
import { resolveLocal } from "../instant/convert/resolveLocal";
import type { OperatingSchedule } from "../types";
import { addUnix } from "../unix/calculate/addUnix";
import { diffUnix } from "../unix/calculate/diffUnix";
import { diffUnixAsDuration } from "../unix/calculate/diffUnixAsDuration";
import { endOfQuarterForUnix } from "../unix/calculate/endOfQuarterForUnix";
import { endOfUnix } from "../unix/calculate/endOfUnix";
import { isBetweenUnix } from "../unix/calculate/isBetweenUnix";
import { roundUnix } from "../unix/calculate/roundUnix";
import { setUnix } from "../unix/calculate/setUnix";
import { startOfQuarterForUnix } from "../unix/calculate/startOfQuarterForUnix";
import { startOfUnix } from "../unix/calculate/startOfUnix";
import { subtractUnix } from "../unix/calculate/subtractUnix";
import { areUnixEqualBy } from "../unix/compare/areUnixEqualBy";
import { convertUnixToPlainDate } from "../unix/convert/convertUnixToPlainDate";
import { convertUnixToPlainDateTime } from "../unix/convert/convertUnixToPlainDateTime";
import { convertUnixToPlainTime } from "../unix/convert/convertUnixToPlainTime";
import { formatRelativeUnix } from "../unix/format/formatRelativeUnix";
import { intervalCountUnix } from "../unix/interval/intervalCountUnix";
import { intervalFromDurationUnix } from "../unix/interval/intervalFromDurationUnix";
import { intervalLengthUnix } from "../unix/interval/intervalLengthUnix";
import { intervalOverlappingDaysUnix } from "../unix/interval/intervalOverlappingDaysUnix";
import { splitIntervalByUnitUnix } from "../unix/interval/splitIntervalByUnitUnix";
import * as unixParse from "../unix/parse";
import { convertUtcToPlainDate } from "../utc/convert/convertUtcToPlainDate";
import { convertUtcToPlainDateTime } from "../utc/convert/convertUtcToPlainDateTime";
import { convertUtcToPlainTime } from "../utc/convert/convertUtcToPlainTime";
import { formatRelativeUtc } from "../utc/format/formatRelativeUtc";
import * as utcParse from "../utc/parse";
import * as zonedGet from "../zoned/get";
import { hasDaylightSaving } from "../zoned/validate/hasDaylightSaving";

const OFFSET = "-00:44:30";
const zone = { timeZone: OFFSET };

/** Local midnight on 1970-01-01 at -00:44:30: 44 min 30 s after the epoch. */
const LOCAL_MIDNIGHT_MS = 2_670_000;
/** 1970-01-01T12:44:30Z, which is local noon. */
const LOCAL_NOON_MS = 45_870_000;
const DAY_MS = 86_400_000;
/** Temporal's last instant, +275760-09-13T00:00:00Z. */
const LAST_INSTANT_MS = 8.64e15;

describe("utc/convert at a stored offset", () => {
  it.each`
    name                           | convert                      | value                     | expected
    ${"convertUtcToPlainDate"}     | ${convertUtcToPlainDate}     | ${"1970-01-01T00:30:00Z"} | ${"1969-12-31"}
    ${"convertUtcToPlainDateTime"} | ${convertUtcToPlainDateTime} | ${"1970-01-01T12:44:30Z"} | ${"1970-01-01T12:00:00"}
    ${"convertUtcToPlainDateTime"} | ${convertUtcToPlainDateTime} | ${"1970-01-01T00:30:00Z"} | ${"1969-12-31T23:45:30"}
    ${"convertUtcToPlainTime"}     | ${convertUtcToPlainTime}     | ${"1970-01-01T12:44:30Z"} | ${"12:00:00"}
  `(
    "$name reads $value at -00:44:30 as $expected",
    ({ convert, value, expected }) => {
      expect(convert(value, zone)).toBe(expected);
    },
  );

  it("convertUtcToPlainTime reads the last instant at +23:59:59 as 23:59:59", () => {
    expect(
      convertUtcToPlainTime("+275760-09-13T00:00:00Z", {
        timeZone: "+23:59:59",
      }),
    ).toBe("23:59:59");
  });
});

describe("utc/parse at a stored offset", () => {
  // 12:44:30.123456789Z is 12:00:00.123456789 local on Thursday 1 January 1970, ISO week 1.
  const value = "1970-01-01T12:44:30.123456789Z";

  it.each`
    name                         | expected
    ${"parseDateFromUtc"}        | ${"1970-01-01"}
    ${"parseDayFromUtc"}         | ${"01"}
    ${"parseDayOfWeekFromUtc"}   | ${4}
    ${"parseHourFromUtc"}        | ${"12"}
    ${"parseMicrosecondFromUtc"} | ${"456"}
    ${"parseMillisecondFromUtc"} | ${"123"}
    ${"parseMinuteFromUtc"}      | ${"00"}
    ${"parseMonthFromUtc"}       | ${"01"}
    ${"parseNanosecondFromUtc"}  | ${"789"}
    ${"parseSecondFromUtc"}      | ${"00"}
    ${"parseTimeFromUtc"}        | ${"12:00:00.123456789"}
    ${"parseWeekFromUtc"}        | ${1}
    ${"parseYearFromUtc"}        | ${"1970"}
  `(
    "$name reads 12:44:30.123456789Z at -00:44:30 as $expected",
    ({ name, expected }: { name: string; expected: unknown }) => {
      const parse = (
        utcParse as unknown as Record<
          string,
          (value: string, options: { timeZone: string }) => unknown
        >
      )[name];

      expect(parse(value, zone)).toBe(expected);
    },
  );

  it.each`
    unit           | expected
    ${"minute"}    | ${"00"}
    ${"second"}    | ${"00"}
    ${"hour"}      | ${"12"}
    ${"dayOfWeek"} | ${"4"}
  `(
    "parseUnitFromUtc reads the $unit of 12:44:30.123456789Z at -00:44:30 as $expected",
    ({ unit, expected }) => {
      expect(utcParse.parseUnitFromUtc(value, unit, zone)).toBe(expected);
    },
  );

  // 00:30:00.123456789Z is 23:45:30.123456789 local on Wednesday 31 December 1969, so the year,
  // month, day, weekday, hour, minute and second all differ from the UTC reading (1970, 01, 01,
  // Thursday, 00, 30, 00) and from the reading with the offset's sign flipped (01:14:30).
  it.each`
    name                       | expected
    ${"parseDateFromUtc"}      | ${"1969-12-31"}
    ${"parseYearFromUtc"}      | ${"1969"}
    ${"parseMonthFromUtc"}     | ${"12"}
    ${"parseDayFromUtc"}       | ${"31"}
    ${"parseDayOfWeekFromUtc"} | ${3}
    ${"parseHourFromUtc"}      | ${"23"}
    ${"parseMinuteFromUtc"}    | ${"45"}
    ${"parseSecondFromUtc"}    | ${"30"}
    ${"parseTimeFromUtc"}      | ${"23:45:30.123456789"}
  `(
    "$name reads 00:30:00.123456789Z at -00:44:30 as $expected, on the day before",
    ({ name, expected }: { name: string; expected: unknown }) => {
      const parse = (
        utcParse as unknown as Record<
          string,
          (value: string, options: { timeZone: string }) => unknown
        >
      )[name];

      expect(parse("1970-01-01T00:30:00.123456789Z", zone)).toBe(expected);
    },
  );

  it.each`
    unit           | expected
    ${"year"}      | ${"1969"}
    ${"month"}     | ${"12"}
    ${"day"}       | ${"31"}
    ${"dayOfWeek"} | ${"3"}
    ${"hour"}      | ${"23"}
    ${"minute"}    | ${"45"}
    ${"second"}    | ${"30"}
  `(
    "parseUnitFromUtc reads the $unit of 00:30:00Z at -00:44:30 as $expected, on the day before",
    ({ unit, expected }) => {
      expect(
        utcParse.parseUnitFromUtc("1970-01-01T00:30:00Z", unit, zone),
      ).toBe(expected);
    },
  );

  // 1970-01-05T00:30:00Z is a Monday in UTC, in ISO week 2. At -00:44:30 it is 23:45:30 on
  // Sunday 4 January, the last day of ISO week 1 (29 December to 4 January).
  it("reads the ISO week of 1970-01-05T00:30:00Z at -00:44:30 as 1, and as 2 in UTC", () => {
    const monday = "1970-01-05T00:30:00Z";

    expect(utcParse.parseWeekFromUtc(monday, zone)).toBe(1);
    expect(utcParse.parseUnitFromUtc(monday, "week", zone)).toBe("1");
    expect(utcParse.parseDayOfWeekFromUtc(monday, zone)).toBe(7);
    expect(utcParse.parseWeekFromUtc(monday)).toBe(2);
  });

  // The last instant is 00:00:00Z on its date; half a minute east it is 00:00:30 local, and a
  // second short of a day east it is still 13 September.
  it("reads the last instant on its local wall clock", () => {
    const last = "+275760-09-13T00:00:00Z";

    expect(utcParse.parseSecondFromUtc(last, { timeZone: "+00:00:30" })).toBe(
      "30",
    );
    expect(utcParse.parseDateFromUtc(last, { timeZone: "+23:59:59" })).toBe(
      "+275760-09-13",
    );
    expect(utcParse.parseTimeFromUtc(last, { timeZone: "+23:59:59" })).toBe(
      "23:59:59",
    );
  });
});

describe("unix/convert and unix/parse at a stored offset", () => {
  // 45 870 123 ms is 12:44:30.123Z, which is 12:00:00.123 local.
  const value = LOCAL_NOON_MS + 123;

  it.each`
    name                            | convert                       | expected
    ${"convertUnixToPlainDate"}     | ${convertUnixToPlainDate}     | ${"1970-01-01"}
    ${"convertUnixToPlainDateTime"} | ${convertUnixToPlainDateTime} | ${"1970-01-01T12:00:00.123"}
    ${"convertUnixToPlainTime"}     | ${convertUnixToPlainTime}     | ${"12:00:00.123"}
  `(
    "$name reads 12:44:30.123Z at -00:44:30 as $expected",
    ({ convert, expected }) => {
      expect(convert(value, zone)).toBe(expected);
    },
  );

  it("convertUnixToPlainDate reads 00:30:00Z at -00:44:30 as the day before", () => {
    expect(convertUnixToPlainDate(1_800_000, zone)).toBe("1969-12-31");
  });

  it.each`
    name                          | expected
    ${"parseDateFromUnix"}        | ${"1970-01-01"}
    ${"parseDayFromUnix"}         | ${"01"}
    ${"parseDayOfWeekFromUnix"}   | ${4}
    ${"parseHourFromUnix"}        | ${"12"}
    ${"parseMicrosecondFromUnix"} | ${"000"}
    ${"parseMillisecondFromUnix"} | ${"123"}
    ${"parseMinuteFromUnix"}      | ${"00"}
    ${"parseMonthFromUnix"}       | ${"01"}
    ${"parseNanosecondFromUnix"}  | ${"000"}
    ${"parseSecondFromUnix"}      | ${"00"}
    ${"parseTimeFromUnix"}        | ${"12:00:00.123"}
    ${"parseWeekFromUnix"}        | ${1}
    ${"parseYearFromUnix"}        | ${"1970"}
  `(
    "$name reads 12:44:30.123Z at -00:44:30 as $expected",
    ({ name, expected }: { name: string; expected: unknown }) => {
      const parse = (
        unixParse as unknown as Record<
          string,
          (value: number, options: { timeZone: string }) => unknown
        >
      )[name];

      expect(parse(value, zone)).toBe(expected);
    },
  );

  // 1 800 123 ms is 00:30:00.123Z: 23:45:30.123 local on Wednesday 31 December 1969.
  it.each`
    name                        | expected
    ${"parseDateFromUnix"}      | ${"1969-12-31"}
    ${"parseYearFromUnix"}      | ${"1969"}
    ${"parseMonthFromUnix"}     | ${"12"}
    ${"parseDayFromUnix"}       | ${"31"}
    ${"parseDayOfWeekFromUnix"} | ${3}
    ${"parseHourFromUnix"}      | ${"23"}
    ${"parseMinuteFromUnix"}    | ${"45"}
    ${"parseSecondFromUnix"}    | ${"30"}
    ${"parseTimeFromUnix"}      | ${"23:45:30.123"}
  `(
    "$name reads 00:30:00.123Z at -00:44:30 as $expected, on the day before",
    ({ name, expected }: { name: string; expected: unknown }) => {
      const parse = (
        unixParse as unknown as Record<
          string,
          (value: number, options: { timeZone: string }) => unknown
        >
      )[name];

      expect(parse(1_800_123, zone)).toBe(expected);
    },
  );

  it.each`
    unit           | expected
    ${"year"}      | ${"1969"}
    ${"month"}     | ${"12"}
    ${"day"}       | ${"31"}
    ${"dayOfWeek"} | ${"3"}
    ${"hour"}      | ${"23"}
    ${"minute"}    | ${"45"}
    ${"second"}    | ${"30"}
  `(
    "parseUnitFromUnix reads the $unit of 00:30:00Z at -00:44:30 as $expected, on the day before",
    ({ unit, expected }) => {
      expect(unixParse.parseUnitFromUnix(1_800_000, unit, zone)).toBe(expected);
    },
  );

  // 347 400 000 ms is 1970-01-05T00:30:00Z, a Monday in ISO week 2 in UTC: 23:45:30 on Sunday
  // 4 January at -00:44:30, the last day of ISO week 1.
  it("reads the ISO week of 1970-01-05T00:30:00Z at -00:44:30 as 1, and as 2 in UTC", () => {
    const monday = 4 * DAY_MS + 1_800_000;

    expect(unixParse.parseWeekFromUnix(monday, zone)).toBe(1);
    expect(unixParse.parseUnitFromUnix(monday, "week", zone)).toBe("1");
    expect(unixParse.parseDayOfWeekFromUnix(monday, zone)).toBe(7);
    expect(unixParse.parseWeekFromUnix(monday)).toBe(2);
  });

  it("parseUnitFromUnix reads the minute of 12:44:30.123Z at -00:44:30 as 00", () => {
    expect(unixParse.parseUnitFromUnix(value, "minute", zone)).toBe("00");
  });

  it("reads the last instant on its local wall clock", () => {
    expect(
      unixParse.parseSecondFromUnix(LAST_INSTANT_MS, { timeZone: "+00:00:30" }),
    ).toBe("30");
    expect(
      convertUnixToPlainDateTime(LAST_INSTANT_MS, { timeZone: "+23:59:59" }),
    ).toBe("+275760-09-13T23:59:59");
  });
});

describe("zoned/get at a stored offset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 12:44:30Z, which is 12:00:00 local on Thursday 1 January 1970.
    vi.setSystemTime(LOCAL_NOON_MS);
  });

  it.each`
    name                     | expected
    ${"getZonedYear"}        | ${"1970"}
    ${"getZonedMonth"}       | ${"01"}
    ${"getZonedDay"}         | ${"01"}
    ${"getZonedDayOfWeek"}   | ${4}
    ${"getZonedHour"}        | ${"12"}
    ${"getZonedMinute"}      | ${"00"}
    ${"getZonedSecond"}      | ${"00"}
    ${"getZonedMillisecond"} | ${"000"}
    ${"getZonedToday"}       | ${"1970-01-01"}
    ${"getZonedWeekOfYear"}  | ${1}
  `(
    "$name reads the clock at 12:44:30Z at -00:44:30 as $expected",
    ({ name, expected }: { name: string; expected: unknown }) => {
      const read = (
        zonedGet as unknown as Record<string, (zone: string) => unknown>
      )[name];

      expect(read(OFFSET)).toBe(expected);
    },
  );

  // The polyfill's clock carries a counter below the millisecond, so these two are read for
  // their shape, as their own suites read them.
  it.each`
    name
    ${"getZonedMicrosecond"}
    ${"getZonedNanosecond"}
  `("$name returns three digits at -00:44:30", ({ name }: { name: string }) => {
    const read = (
      zonedGet as unknown as Record<string, (zone: string) => unknown>
    )[name];

    expect(read(OFFSET)).toMatch(/^\d{3}$/);
  });

  it.each`
    unit           | expected
    ${"year"}      | ${"1970"}
    ${"month"}     | ${"01"}
    ${"week"}      | ${"1"}
    ${"day"}       | ${"01"}
    ${"dayOfWeek"} | ${"4"}
    ${"hour"}      | ${"12"}
    ${"minute"}    | ${"00"}
    ${"second"}    | ${"00"}
  `(
    "getZonedNowUnit reads the $unit of the clock at -00:44:30 as $expected",
    ({ unit, expected }) => {
      expect(zonedGet.getZonedNowUnit(OFFSET, unit)).toBe(expected);
    },
  );

  // The clock is 00:30:00Z: 23:45:30 on Wednesday 31 December 1969 at -00:44:30. Every field
  // differs from the UTC reading (1970, 01, 01, Thursday, 00, 30, 00).
  it.each`
    name                   | expected
    ${"getZonedToday"}     | ${"1969-12-31"}
    ${"getZonedYear"}      | ${"1969"}
    ${"getZonedMonth"}     | ${"12"}
    ${"getZonedDay"}       | ${"31"}
    ${"getZonedDayOfWeek"} | ${3}
    ${"getZonedHour"}      | ${"23"}
    ${"getZonedMinute"}    | ${"45"}
    ${"getZonedSecond"}    | ${"30"}
  `(
    "$name reads the clock at 00:30:00Z at -00:44:30 as $expected, on the day before",
    ({ name, expected }: { name: string; expected: unknown }) => {
      vi.setSystemTime(1_800_000);
      const read = (
        zonedGet as unknown as Record<string, (zone: string) => unknown>
      )[name];

      expect(read(OFFSET)).toBe(expected);
    },
  );

  it.each`
    unit           | expected
    ${"year"}      | ${"1969"}
    ${"month"}     | ${"12"}
    ${"day"}       | ${"31"}
    ${"dayOfWeek"} | ${"3"}
    ${"hour"}      | ${"23"}
    ${"minute"}    | ${"45"}
    ${"second"}    | ${"30"}
  `(
    "getZonedNowUnit reads the $unit of the clock at 00:30:00Z at -00:44:30 as $expected, on the day before",
    ({ unit, expected }) => {
      vi.setSystemTime(1_800_000);

      expect(zonedGet.getZonedNowUnit(OFFSET, unit)).toBe(expected);
    },
  );

  // The clock is 1970-01-05T00:30:00Z, a Monday in ISO week 2 in UTC: Sunday 4 January at
  // -00:44:30, the last day of ISO week 1.
  it("reads the ISO week of the clock at 1970-01-05T00:30:00Z at -00:44:30 as 1, and as 2 in UTC", () => {
    vi.setSystemTime(4 * DAY_MS + 1_800_000);

    expect(zonedGet.getZonedWeekOfYear(OFFSET)).toBe(1);
    expect(zonedGet.getZonedNowUnit(OFFSET, "week")).toBe("1");
    expect(zonedGet.getZonedDayOfWeek(OFFSET)).toBe(7);
    expect(zonedGet.getZonedWeekOfYear("UTC")).toBe(2);
  });

  it("returns the sentinel when the clock cannot be read", () => {
    vi.spyOn(Temporal.Now, "instant").mockImplementation(() => {
      throw new RangeError("no clock");
    });

    expect(zonedGet.getZonedHour(OFFSET)).toBe("");
    expect(zonedGet.getZonedDayOfWeek(OFFSET)).toBeNull();
    expect(zonedGet.getZonedNowUnit(OFFSET, "hour")).toBe("");
  });
});

describe("zone lookups at a stored offset", () => {
  it("has no transitions and no daylight time, like any fixed offset", () => {
    expect(zonedGet.getDstTransitions(OFFSET, 1970)).toEqual([]);
    expect(zonedGet.getDstTransitions("-00:45", 1970)).toEqual([]);
    expect(hasDaylightSaving(OFFSET)).toBe(false);
    expect(hasDaylightSaving(OFFSET, { at: "1970-01-01T12:00:00Z" })).toBe(
      false,
    );
  });
});

describe("unix/calculate at a stored offset", () => {
  it.each`
    unit      | value                      | expected                          | reason
    ${"day"}  | ${LOCAL_NOON_MS}           | ${LOCAL_MIDNIGHT_MS}              | ${"local midnight"}
    ${"hour"} | ${LOCAL_NOON_MS + 930_000} | ${LOCAL_NOON_MS}                  | ${"12:15:30 local falls back to 12:00"}
    ${"week"} | ${LOCAL_NOON_MS}           | ${LOCAL_MIDNIGHT_MS - 3 * DAY_MS} | ${"Thursday back to Monday 29 December"}
  `(
    "startOfUnix returns $expected for the $unit of $value ($reason)",
    ({ unit, value, expected }) => {
      expect(startOfUnix(value, unit, zone)).toBe(expected);
    },
  );

  it("endOfUnix returns the last millisecond of the local day", () => {
    expect(endOfUnix(LOCAL_NOON_MS, "day", zone)).toBe(
      LOCAL_MIDNIGHT_MS + DAY_MS - 1,
    );
  });

  // The first quarter of 1970 is 31 + 28 + 31 = 90 local days from local midnight on 1 January.
  it("returns the local quarter's first and last milliseconds", () => {
    expect(startOfQuarterForUnix(LOCAL_NOON_MS, zone)).toBe(LOCAL_MIDNIGHT_MS);
    expect(endOfQuarterForUnix(LOCAL_NOON_MS, zone)).toBe(
      LOCAL_MIDNIGHT_MS + 90 * DAY_MS - 1,
    );
  });

  // 1970-01-31T00:30:00Z is 30 January 23:45:30 local. A month later is 28 February 23:45:30
  // local (30 February clamps), which is 1 March 00:30:00Z: 59 days and 30 minutes after the
  // epoch. In UTC the same instant is 31 January, and a month later is 28 February 00:30:00Z.
  const jan30Local = 30 * DAY_MS + 1_800_000;
  const feb28Local = 59 * DAY_MS + 1_800_000;

  it("addUnix adds a month on the local date, not the UTC one", () => {
    expect(addUnix(jan30Local, { months: 1 }, zone)).toBe(feb28Local);
    expect(addUnix(jan30Local, { months: 1 })).toBe(58 * DAY_MS + 1_800_000);
    expect(addUnix(LOCAL_NOON_MS, { days: 1 }, zone)).toBe(
      LOCAL_NOON_MS + DAY_MS,
    );
  });

  // 28 February 23:45:30 local less a month is 28 January 23:45:30 local: 29 January 00:30:00Z.
  it("subtractUnix subtracts a month on the local date", () => {
    expect(subtractUnix(feb28Local, { months: 1 }, zone)).toBe(
      28 * DAY_MS + 1_800_000,
    );
  });

  // From 28 February 23:45:30 local to 31 March 23:45:30 local (1 April 00:30:00Z) is one month
  // to 28 March and three days more. In UTC the same instants are 1 March and 1 April: one month.
  const mar31Local = 90 * DAY_MS + 1_800_000;

  it("diffUnix and diffUnixAsDuration measure on the local dates", () => {
    expect(diffUnix(feb28Local, mar31Local, ["months", "days"], zone)).toEqual({
      months: 1,
      days: 3,
    });
    expect(diffUnix(feb28Local, mar31Local, ["months", "days"])).toEqual({
      months: 1,
      days: 0,
    });
    expect(diffUnixAsDuration(feb28Local, mar31Local, "months", zone)).toBe(
      "P1M3D",
    );
  });

  it.each`
    value                     | smallestUnit | expected                      | reason
    ${LOCAL_NOON_MS + 1}      | ${"day"}     | ${LOCAL_MIDNIGHT_MS + DAY_MS} | ${"a millisecond past local noon rounds up"}
    ${LOCAL_NOON_MS - 1}      | ${"day"}     | ${LOCAL_MIDNIGHT_MS}          | ${"a millisecond before local noon rounds down"}
    ${LOCAL_NOON_MS + 29_000} | ${"minute"}  | ${LOCAL_NOON_MS}              | ${"12:00:29 local rounds to 12:00"}
  `(
    "roundUnix rounds $value to the $smallestUnit as $expected ($reason)",
    ({ value, smallestUnit, expected }) => {
      expect(roundUnix(value, { smallestUnit, ...zone })).toBe(expected);
    },
  );

  it("setUnix sets fields on the local clock", () => {
    expect(
      setUnix(LOCAL_NOON_MS, { hour: 0, minute: 0, second: 0 }, zone),
    ).toBe(LOCAL_MIDNIGHT_MS);
  });

  it("isBetweenUnix accepts the offset and compares the instants", () => {
    expect(
      isBetweenUnix(LOCAL_NOON_MS, LOCAL_NOON_MS - 1, LOCAL_NOON_MS + 1, zone),
    ).toBe(true);
    expect(
      isBetweenUnix(
        LOCAL_NOON_MS + 2,
        LOCAL_NOON_MS - 1,
        LOCAL_NOON_MS + 1,
        zone,
      ),
    ).toBe(false);
  });

  // The local day turns at 00:44:30Z, not at 00:00:00Z.
  it("areUnixEqualBy compares local days", () => {
    expect(
      areUnixEqualBy(LOCAL_MIDNIGHT_MS - 1, LOCAL_MIDNIGHT_MS, "day", zone),
    ).toBe(false);
    expect(
      areUnixEqualBy(
        LOCAL_MIDNIGHT_MS,
        LOCAL_MIDNIGHT_MS + DAY_MS - 1,
        "day",
        zone,
      ),
    ).toBe(true);
    expect(
      areUnixEqualBy(LOCAL_MIDNIGHT_MS - 1, LOCAL_MIDNIGHT_MS, "day"),
    ).toBe(true);
  });

  // The last instant is 23:15:30 local on 12 September, whose local midnight is 00:44:30Z that day.
  it("startOfUnix finds the local day of the last instant", () => {
    expect(startOfUnix(LAST_INSTANT_MS, "day", zone)).toBe(
      LAST_INSTANT_MS - DAY_MS + LOCAL_MIDNIGHT_MS,
    );
  });
});

describe("unix/interval at a stored offset", () => {
  it("intervalCountUnix counts the local days an interval touches", () => {
    expect(
      intervalCountUnix(
        LOCAL_MIDNIGHT_MS - 1,
        LOCAL_MIDNIGHT_MS + 1,
        "day",
        zone,
      ),
    ).toBe(2);
    expect(
      intervalCountUnix(LOCAL_MIDNIGHT_MS - 1, LOCAL_MIDNIGHT_MS + 1, "day"),
    ).toBe(1);
  });

  it("intervalLengthUnix measures a day and a half as 1.5 days", () => {
    expect(
      intervalLengthUnix(
        LOCAL_MIDNIGHT_MS,
        LOCAL_MIDNIGHT_MS + 1.5 * DAY_MS,
        "day",
        zone,
      ),
    ).toBe(1.5);
  });

  // 30 January 23:45:30 local plus a month clamps to 28 February 23:45:30 local.
  const jan30Local = 30 * DAY_MS + 1_800_000;
  const feb28Local = 59 * DAY_MS + 1_800_000;

  it("intervalFromDurationUnix adds the duration on the local date", () => {
    expect(intervalFromDurationUnix(jan30Local, "P1M", "start", zone)).toEqual({
      start: jan30Local,
      end: feb28Local,
    });
  });

  // The same two instants are exactly one local month apart: 30 January 23:45:30 local plus a
  // month is 28 February 23:45:30 local. Read with the offset's sign flipped they are 31 January
  // and 1 March 01:14:30, a month and a day.
  it("intervalLengthUnix measures the local month as exactly 1", () => {
    expect(intervalLengthUnix(jan30Local, feb28Local, "month", zone)).toBe(1);
  });

  it("intervalOverlappingDaysUnix counts the local days of the overlap", () => {
    const start = LOCAL_MIDNIGHT_MS - 1000;
    const end = LOCAL_MIDNIGHT_MS + 1000;

    expect(intervalOverlappingDaysUnix(start, end, start, end, zone)).toBe(2);
    expect(intervalOverlappingDaysUnix(start, end, start, end)).toBe(1);
  });

  // Steps are anchored at the start: one month is 28 February, two months is 30 March 23:45:30
  // local (31 March 00:30:00Z, 89 days and 30 minutes after the epoch), never 28 March.
  it("splitIntervalByUnitUnix steps by local months from the start", () => {
    const end = jan30Local + 60 * DAY_MS;
    const mar30Local = 89 * DAY_MS + 1_800_000;

    expect(splitIntervalByUnitUnix(jan30Local, end, "month", 1, zone)).toEqual([
      { start: jan30Local, end: feb28Local },
      { start: feb28Local, end: mar30Local },
      { start: mar30Local, end },
    ]);
  });

  it("counts the one local day the last millisecond of the range touches", () => {
    expect(
      intervalCountUnix(LAST_INSTANT_MS - 1, LAST_INSTANT_MS, "day", zone),
    ).toBe(1);
  });
});

describe("relative formatting at a stored offset", () => {
  // Two days is two days in every zone, so the text is the one UTC gives.
  it("formats a two-day difference as it does in UTC", () => {
    const options = { reference: "1970-01-01T12:00:00Z" };
    const inUtc = formatRelativeUtc("1970-01-03T12:00:00Z", "en-US", options);

    expect(inUtc).not.toBe("");
    expect(
      formatRelativeUtc("1970-01-03T12:00:00Z", "en-US", {
        ...options,
        ...zone,
      }),
    ).toBe(inUtc);
    expect(
      formatRelativeUnix(LOCAL_NOON_MS + 2 * DAY_MS, "en-US", {
        reference: LOCAL_NOON_MS,
        ...zone,
      }),
    ).toBe(inUtc);
  });

  // A month is measured from the reference's local date. 1970-03-01T00:30:00Z is 28 February
  // 23:45:30 at -00:44:30, and 28 days later is 28 March 23:45:30: exactly one month. In UTC the
  // same instants are 1 March and 29 March, 28 days of a 31-day month, which floors to none. The
  // wording is the one UTC gives for a span that is one month by inspection, 15 March to 15 April.
  it("measures a month from the reference's local date", () => {
    const options = {
      largestUnit: "month",
      roundingMethod: "floor",
      numeric: "always",
    } as const;
    const reference = "1970-03-01T00:30:00Z";
    const value = "1970-03-29T00:30:00Z";
    const oneMonth = formatRelativeUtc("1970-04-15T00:00:00Z", "en-US", {
      ...options,
      reference: "1970-03-15T00:00:00Z",
    });
    const inUtc = formatRelativeUtc(value, "en-US", { ...options, reference });

    expect(oneMonth).not.toBe("");
    expect(inUtc).not.toBe("");
    expect(inUtc).not.toBe(oneMonth);
    expect(
      formatRelativeUtc(value, "en-US", { ...options, reference, ...zone }),
    ).toBe(oneMonth);
    expect(
      formatRelativeUnix(87 * DAY_MS + 1_800_000, "en-US", {
        ...options,
        reference: 59 * DAY_MS + 1_800_000,
        ...zone,
      }),
    ).toBe(oneMonth);
  });

  it.each`
    timeZone
    ${"Z"}
    ${"+05:30:00.5"}
    ${"+24:00:00"}
  `(
    'returns "" for $timeZone, which is neither a zone nor an offset',
    ({ timeZone }) => {
      expect(
        formatRelativeUtc("1970-01-03T12:00:00Z", "en-US", {
          reference: "1970-01-01T12:00:00Z",
          timeZone,
        }),
      ).toBe("");
      expect(
        formatRelativeUnix(LOCAL_NOON_MS + 2 * DAY_MS, "en-US", {
          reference: LOCAL_NOON_MS,
          timeZone,
        }),
      ).toBe("");
    },
  );
});

describe("calendar/calculate at a stored offset", () => {
  // 13:00:00Z is 12:15:30 local on Thursday 1 January 1970.
  it.each`
    unit       | expected                  | reason
    ${"hour"}  | ${"1970-01-01T12:44:30Z"} | ${"12:00 local"}
    ${"day"}   | ${"1970-01-01T00:44:30Z"} | ${"local midnight"}
    ${"week"}  | ${"1969-12-29T00:44:30Z"} | ${"local midnight on Monday"}
    ${"month"} | ${"1970-01-01T00:44:30Z"} | ${"local midnight on the 1st"}
  `(
    "floorToZone floors 13:00:00Z to the $unit as $expected ($reason)",
    ({ unit, expected }) => {
      expect(floorToZone("1970-01-01T13:00:00Z", unit, OFFSET)).toBe(expected);
    },
  );

  // 00:00:00Z is 23:15:30 local on 31 December, so the range opens in that local day.
  it("bucketRange lists the local midnights of the days a range touches", () => {
    expect(
      bucketRange(
        "1970-01-01T00:00:00Z",
        "1970-01-02T01:00:00Z",
        "day",
        OFFSET,
      ),
    ).toEqual([
      "1969-12-31T00:44:30Z",
      "1970-01-01T00:44:30Z",
      "1970-01-02T00:44:30Z",
    ]);
  });

  it("floorToZone finds the local day of the last instant", () => {
    expect(floorToZone("+275760-09-13T00:00:00Z", "day", OFFSET)).toBe(
      "+275760-09-12T00:44:30Z",
    );
  });
});

describe("calendar/hours at a stored offset", () => {
  const weekdays = ["1", "2", "3", "4", "5", "6", "7"] as const;
  const weekly = Object.fromEntries(
    weekdays.map((day) => [day, [{ from: "08:00", to: "17:00" }]]),
  ) as OperatingSchedule["weekly"];
  const schedule: OperatingSchedule = { timeZone: OFFSET, weekly };
  const day = { start: "1970-01-01T00:00:00Z", end: "1970-01-02T00:00:00Z" };
  // 08:00 local is 08:44:30Z and 17:00 local is 17:44:30Z.
  const window = { start: "1970-01-01T08:44:30Z", end: "1970-01-01T17:44:30Z" };

  it.each`
    at                        | expected | reason
    ${"1970-01-01T08:44:30Z"} | ${true}  | ${"08:00:00 local, the opening instant"}
    ${"1970-01-01T08:44:29Z"} | ${false} | ${"a second before opening"}
    ${"1970-01-01T17:44:30Z"} | ${false} | ${"17:00:00 local, the closing instant, is outside"}
  `("isOpenAt returns $expected at $at ($reason)", ({ at, expected }) => {
    expect(isOpenAt(at, schedule)).toBe(expected);
  });

  it("finds the next opening and closing on the local clock", () => {
    expect(nextOpenAt("1970-01-01T00:00:00Z", schedule)).toBe(window.start);
    expect(nextCloseAt("1970-01-01T09:00:00Z", schedule)).toBe(window.end);
  });

  it("lists the local window as instants", () => {
    expect(operatingIntervals(schedule, day)).toEqual([window]);
    expect(recurringWindows(weekly, day, OFFSET)).toEqual([window]);
  });

  it("operatingTimeBetween counts the nine open hours", () => {
    expect(operatingTimeBetween(day.start, day.end, schedule)).toBe("PT9H");
  });

  // 08:00:00Z is 07:15:30 local, before opening, and 09:00:00Z is 08:15:30 local: 15 min 30 s
  // after the 08:00 opening at 08:44:30Z. A window placed 44 min 30 s the other way would give
  // the whole hour, and one at -00:45 would give PT15M.
  it("operatingTimeBetween counts from the local opening instant", () => {
    expect(
      operatingTimeBetween(
        "1970-01-01T08:00:00Z",
        "1970-01-01T09:00:00Z",
        schedule,
      ),
    ).toBe("PT15M30S");
  });

  // Nine hours on 1 January, then one more from 08:00 local on the 2nd: 09:00 local.
  it("addOperatingTime carries open time into the next local day", () => {
    expect(addOperatingTime(window.start, "PT10H", schedule)).toBe(
      "1970-01-02T09:44:30Z",
    );
  });

  it("isOpenAt answers at the last instant for a schedule that never closes", () => {
    const alwaysOpen: OperatingSchedule = {
      timeZone: OFFSET,
      weekly: Object.fromEntries(
        weekdays.map((d) => [d, [{ from: "00:00", to: "00:00" }]]),
      ) as OperatingSchedule["weekly"],
    };

    expect(isOpenAt("+275760-09-13T00:00:00Z", alwaysOpen)).toBe(true);
  });
});

describe("intermodal at a stored offset", () => {
  // 00:30:00Z on 1 January is 23:45:30 local on 31 December.
  const event = "1970-01-01T00:30:00Z";

  it("bolTimestamp dates the event on the local day", () => {
    expect(bolTimestamp(event, "issue", zone)).toBe("1969-12-31");
    expect(
      bolTimestamp("+275760-09-13T00:00:00Z", "issue", {
        timeZone: "+23:59:59",
      }),
    ).toBe("+275760-09-13");
  });

  // Free days are 31 December, 1 January and 2 January; free time ends at local midnight on the 3rd.
  it("freeTimeExpiry counts local days and expires at local midnight", () => {
    expect(
      freeTimeExpiry(event, 3, {
        basis: "calendar",
        firstDay: "eventDay",
        timeZone: OFFSET,
      }),
    ).toEqual({
      freeTimeStart: "1969-12-31",
      lastFreeDay: "1970-01-02",
      expiresAt: "1970-01-03T00:44:30Z",
    });
  });

  // The exit at 12:00:00Z on 5 January is 11:15:30 local that day, so 3, 4 and 5 January are charged.
  it("chargeableDays charges the local days after free time", () => {
    expect(
      chargeableDays(event, "1970-01-05T12:00:00Z", 3, {
        basis: "calendar",
        chargeBasis: "calendar",
        firstDay: "eventDay",
        timeZone: OFFSET,
      }),
    ).toEqual({
      freeDaysUsed: 3,
      chargeableDays: 3,
      expiresAt: "1970-01-03T00:44:30Z",
      chargedDates: ["1970-01-03", "1970-01-04", "1970-01-05"],
      byTier: [{ from: 1, to: null, days: 3 }],
    });
  });

  // Ten days before the last instant, 00:30:00Z is 23:45:30 local on 2 September.
  it("freeTimeExpiry lays out free time near the last instant", () => {
    expect(
      freeTimeExpiry("+275760-09-03T00:30:00Z", 3, {
        basis: "calendar",
        firstDay: "eventDay",
        timeZone: OFFSET,
      }),
    ).toEqual({
      freeTimeStart: "+275760-09-02",
      lastFreeDay: "+275760-09-04",
      expiresAt: "+275760-09-05T00:44:30Z",
    });
  });
});

/**
 * The widest stored offsets, a second short of a day either side of UTC.
 *
 * 1970-01-01T12:00:00Z (43 200 000 ms, a Thursday in UTC) is 11:59:59 on Friday 2 January at
 * `+23:59:59` and 12:00:01 on Wednesday 31 December at `-23:59:59`: local time is the instant plus
 * the offset (TC39 Temporal GetISODateTimeFor). Local midnight on 2 January at `+23:59:59` is
 * 00:00:01Z on the 1st, and local midnight on 31 December at `-23:59:59` is 23:59:59Z that day.
 */
describe("the widest stored offsets", () => {
  const NOON = "1970-01-01T12:00:00Z";
  const NOON_MS = 43_200_000;
  const allDayOn = (day: "3" | "5", timeZone: string): OperatingSchedule => ({
    timeZone,
    weekly: { [day]: [{ from: "00:00", to: "00:00" }] },
  });
  const freeTime = (timeZone: string) =>
    ({ basis: "calendar", firstDay: "eventDay", timeZone }) as const;

  it.each`
    timeZone       | dateTime                 | date            | dayStart                  | dayStartMs
    ${"+23:59:59"} | ${"1970-01-02T11:59:59"} | ${"1970-01-02"} | ${"1970-01-01T00:00:01Z"} | ${1000}
    ${"-23:59:59"} | ${"1969-12-31T12:00:01"} | ${"1969-12-31"} | ${"1969-12-31T23:59:59Z"} | ${-1000}
  `(
    "reads 12:00:00Z at $timeZone as $dateTime, whose local day starts at $dayStart",
    ({ timeZone, dateTime, date, dayStart, dayStartMs }) => {
      expect(convertUtcToPlainDateTime(NOON, { timeZone })).toBe(dateTime);
      expect(convertUnixToPlainDate(NOON_MS, { timeZone })).toBe(date);
      expect(bolTimestamp(NOON, "issue", { timeZone })).toBe(date);
      expect(zonedGet.getTimeZoneOffset(timeZone, NOON)).toBe(timeZone);
      expect(startOfUnix(NOON_MS, "day", { timeZone })).toBe(dayStartMs);
      expect(floorToZone(NOON, "day", timeZone)).toBe(dayStart);
      expect(resolveLocal(dateTime, timeZone)).toBe(NOON);
    },
  );

  // One free day is the local day itself, so free time ends at the next local midnight.
  it.each`
    timeZone       | freeDay         | expiresAt
    ${"+23:59:59"} | ${"1970-01-02"} | ${"1970-01-02T00:00:01Z"}
    ${"-23:59:59"} | ${"1969-12-31"} | ${"1970-01-01T23:59:59Z"}
  `(
    "freeTimeExpiry gives 12:00:00Z at $timeZone the free day $freeDay, expiring at $expiresAt",
    ({ timeZone, freeDay, expiresAt }) => {
      expect(freeTimeExpiry(NOON, 1, freeTime(timeZone))).toEqual({
        freeTimeStart: freeDay,
        lastFreeDay: freeDay,
        expiresAt,
      });
    },
  );

  // ISO weekday 5 is Friday and 3 is Wednesday. In UTC the instant is a Thursday, so a schedule
  // read on the wrong day answers false in every row.
  it.each`
    timeZone       | openDay | expected | reason
    ${"+23:59:59"} | ${"5"}  | ${true}  | ${"local Friday"}
    ${"+23:59:59"} | ${"3"}  | ${false} | ${"local Friday, open Wednesday only"}
    ${"-23:59:59"} | ${"3"}  | ${true}  | ${"local Wednesday"}
    ${"-23:59:59"} | ${"5"}  | ${false} | ${"local Wednesday, open Friday only"}
  `(
    "isOpenAt returns $expected at 12:00:00Z at $timeZone for a schedule open on weekday $openDay ($reason)",
    ({ timeZone, openDay, expected }) => {
      expect(isOpenAt(NOON, allDayOn(openDay, timeZone))).toBe(expected);
    },
  );
});

/**
 * A stored offset is a fixed rule, not the zone that once held it.
 *
 * `Africa/Monrovia` stood at `-00:44:30` and moved to `+00:00` in January 1972. The offset keeps
 * giving `-00:44:30` after the change; the zone does not. What the zone gives is asked of plain
 * Temporal at run time, never of a table of IANA history, and each row first proves the zone's
 * offset is what the row relies on.
 */
describe("a stored offset next to the zone that once held it", () => {
  const ZONE = "Africa/Monrovia";
  const offsetOf = (at: string): string =>
    Temporal.Instant.from(at).toZonedDateTimeISO(ZONE).offset;
  const BEFORE = "1971-06-15T12:00:00Z";
  const AFTER = "1973-06-15T12:00:00Z";

  it("the zone stood at -00:44:30 in 1971 and at +00:00 in 1973", () => {
    expect(offsetOf(BEFORE)).toBe(OFFSET);
    expect(offsetOf(AFTER)).toBe("+00:00");
    expect(zonedGet.getTimeZoneOffset(ZONE, BEFORE)).toBe(OFFSET);
    expect(zonedGet.getTimeZoneOffset(ZONE, AFTER)).toBe("+00:00");
    expect(zonedGet.getTimeZoneOffset(OFFSET, AFTER)).toBe(OFFSET);
  });

  // 12:00:00Z less 44 min 30 s is 11:15:30 local, in either year.
  it.each`
    at        | atOffset                 | zoneAgrees
    ${BEFORE} | ${"1971-06-15T11:15:30"} | ${true}
    ${AFTER}  | ${"1973-06-15T11:15:30"} | ${false}
  `(
    "convertUtcToPlainDateTime reads $at at -00:44:30 as $atOffset; the zone agrees: $zoneAgrees",
    ({ at, atOffset, zoneAgrees }) => {
      const inZone = Temporal.Instant.from(at)
        .toZonedDateTimeISO(ZONE)
        .toPlainDateTime()
        .toString();

      expect(convertUtcToPlainDateTime(at, zone)).toBe(atOffset);
      expect(convertUtcToPlainDateTime(at, { timeZone: ZONE })).toBe(inZone);
      expect(inZone === atOffset).toBe(zoneAgrees);
    },
  );

  // 12:00:00 local plus 44 min 30 s is 12:44:30Z, in either year.
  it.each`
    local                    | atOffset                  | zoneAgrees
    ${"1971-06-15T12:00:00"} | ${"1971-06-15T12:44:30Z"} | ${true}
    ${"1973-06-15T12:00:00"} | ${"1973-06-15T12:44:30Z"} | ${false}
  `(
    "resolveLocal reads $local at -00:44:30 as $atOffset; the zone agrees: $zoneAgrees",
    ({ local, atOffset, zoneAgrees }) => {
      const inZone = Temporal.PlainDateTime.from(local)
        .toZonedDateTime(ZONE)
        .toInstant()
        .toString();

      expect(resolveLocal(local, OFFSET)).toBe(atOffset);
      expect(resolveLocal(local, ZONE)).toBe(inZone);
      expect(inZone === atOffset).toBe(zoneAgrees);
    },
  );

  // Two days on from 1972-01-06T12:00:00Z the zone has changed. At the fixed offset two days are
  // 48 hours; in the zone the wall time 11:15:30 is kept and the instant lands 44 min 30 s earlier.
  it("addUnix adds two days across the zone's change as 48 hours at the offset", () => {
    const start = Temporal.Instant.from("1972-01-06T12:00:00Z");
    const inZone = start.toZonedDateTimeISO(ZONE).add({ days: 2 });

    expect(start.toZonedDateTimeISO(ZONE).offset).toBe(OFFSET);
    expect(inZone.offset).toBe("+00:00");
    expect(addUnix(start.epochMilliseconds, { days: 2 }, zone)).toBe(
      start.epochMilliseconds + 2 * DAY_MS,
    );
    expect(
      addUnix(start.epochMilliseconds, { days: 2 }, { timeZone: ZONE }),
    ).toBe(inZone.epochMilliseconds);
    expect(inZone.epochMilliseconds).toBe(
      start.epochMilliseconds + 2 * DAY_MS - LOCAL_MIDNIGHT_MS,
    );
  });

  it("the zone has a transition in 1972 and the offset has none", () => {
    const change = Temporal.Instant.from("1972-01-01T00:00:00Z")
      .toZonedDateTimeISO(ZONE)
      .getTimeZoneTransition("next");

    expect(change?.year).toBe(1972);
    expect(zonedGet.getDstTransitions(ZONE, 1972)).toEqual([
      {
        instant: change?.toInstant().toString(),
        offsetBefore: OFFSET,
        offsetAfter: "+00:00",
      },
    ]);
    expect(zonedGet.getDstTransitions(OFFSET, 1972)).toEqual([]);
  });
});

/**
 * The limit of arithmetic at an offset with seconds.
 *
 * A function that does arithmetic in the zone places each instant in a stand-in zone, because no
 * time zone identifier carries seconds: the offset's whole minutes are the zone, and the instant
 * is moved by the offset's seconds so that the wall clock there is the real local one
 * (`frameZoned`). The moved instant has to be inside Temporal's instant range. So within the
 * offset's seconds (under a minute) of one end of the range the function returns its sentinel:
 * the last instant for an offset east of UTC, the first for one west. An offset to the minute is
 * a real time zone and has no such limit.
 *
 * Every row sets an offset with seconds beside the minute offset next to it. Each minute-offset
 * value is worked by hand: local time is the instant plus the offset.
 */
describe("the limit of arithmetic at a stored offset with seconds", () => {
  /** Temporal's first instant, -271821-04-20T00:00:00Z. */
  const FIRST_INSTANT_MS = -8.64e15;
  const HOUR_MS = 3_600_000;
  /** 45 minutes, the minute offset next to 44 minutes 30 seconds. */
  const NEXT_MINUTE_MS = 2_700_000;
  const last = "+275760-09-13T00:00:00Z";
  const first = "-271821-04-20T00:00:00Z";
  const at = (ms: number): string =>
    Temporal.Instant.fromEpochMilliseconds(ms).toString();
  const weekdays = ["1", "2", "3", "4", "5", "6", "7"] as const;
  const everyDay = (from: string, to: string): OperatingSchedule["weekly"] =>
    Object.fromEntries(
      weekdays.map((d) => [d, [{ from, to }]]),
    ) as OperatingSchedule["weekly"];
  const alwaysOpen = (timeZone: string): OperatingSchedule => ({
    timeZone,
    weekly: everyDay("00:00", "00:00"),
  });
  const businessHours = (timeZone: string): OperatingSchedule => ({
    timeZone,
    weekly: everyDay("08:00", "17:00"),
  });
  const freeTime = (timeZone: string) =>
    ({ basis: "calendar", firstDay: "eventDay", timeZone }) as const;

  // At +00:44:30 the stand-in is +00:44, thirty seconds on. In the last 30 seconds of the range
  // that is past the last instant. At +00:45 the same calls answer: local time is 45 minutes on,
  // so the last instant is 00:45 on 13 September and its local midnight is 23:15:00Z the day before.
  it.each`
    name                          | call                                                                                                                      | sentinel | atMinuteOffset
    ${"startOfUnix"}              | ${(timeZone: string) => startOfUnix(LAST_INSTANT_MS, "day", { timeZone })}                                                | ${null}  | ${LAST_INSTANT_MS - NEXT_MINUTE_MS}
    ${"endOfUnix"}                | ${(timeZone: string) => endOfUnix(LAST_INSTANT_MS - 1000, "second", { timeZone })}                                        | ${null}  | ${LAST_INSTANT_MS - 1}
    ${"addUnix"}                  | ${(timeZone: string) => addUnix(LAST_INSTANT_MS - DAY_MS, { days: 1 }, { timeZone })}                                     | ${null}  | ${LAST_INSTANT_MS}
    ${"subtractUnix"}             | ${(timeZone: string) => subtractUnix(LAST_INSTANT_MS, { days: 1 }, { timeZone })}                                         | ${null}  | ${LAST_INSTANT_MS - DAY_MS}
    ${"roundUnix"}                | ${(timeZone: string) => roundUnix(LAST_INSTANT_MS - 400, { smallestUnit: "second", timeZone })}                           | ${null}  | ${LAST_INSTANT_MS}
    ${"setUnix"}                  | ${(timeZone: string) => setUnix(LAST_INSTANT_MS, { millisecond: 0 }, { timeZone })}                                       | ${null}  | ${LAST_INSTANT_MS}
    ${"floorToZone"}              | ${(timeZone: string) => floorToZone(last, "day", timeZone)}                                                               | ${""}    | ${"+275760-09-12T23:15:00Z"}
    ${"bucketRange"}              | ${(timeZone: string) => bucketRange(at(LAST_INSTANT_MS - 2 * HOUR_MS), last, "hour", timeZone)}                           | ${[]}    | ${["+275760-09-12T21:15:00Z", "+275760-09-12T22:15:00Z", "+275760-09-12T23:15:00Z"]}
    ${"intervalFromDurationUnix"} | ${(timeZone: string) => intervalFromDurationUnix(LAST_INSTANT_MS - DAY_MS, "P1D", "start", { timeZone })}                 | ${null}  | ${{ start: LAST_INSTANT_MS - DAY_MS, end: LAST_INSTANT_MS }}
    ${"splitIntervalByUnitUnix"}  | ${(timeZone: string) => splitIntervalByUnitUnix(LAST_INSTANT_MS - 2 * HOUR_MS, LAST_INSTANT_MS, "hour", 1, { timeZone })} | ${[]}    | ${[{ start: LAST_INSTANT_MS - 2 * HOUR_MS, end: LAST_INSTANT_MS - HOUR_MS }, { start: LAST_INSTANT_MS - HOUR_MS, end: LAST_INSTANT_MS }]}
    ${"addOperatingTime"}         | ${(timeZone: string) => addOperatingTime(at(LAST_INSTANT_MS - 10_000), "PT5S", alwaysOpen(timeZone))}                     | ${""}    | ${"+275760-09-12T23:59:55Z"}
  `(
    "$name returns its sentinel at +00:44:30 in the last 30 seconds of the range, and a value at +00:45",
    ({ call, sentinel, atMinuteOffset }) => {
      expect(call("+00:44:30")).toEqual(sentinel);
      expect(call("+00:45")).toEqual(atMinuteOffset);
    },
  );

  // At -00:44:30 the stand-in is -00:44, thirty seconds back. In the first 30 seconds of the
  // range that is before the first instant. At -00:45 the same calls answer: local time is 45
  // minutes back, so the first instant is 23:15 on 19 April and the next local midnight is 00:45:00Z.
  it.each`
    name                          | call                                                                                                                        | sentinel | atMinuteOffset
    ${"startOfUnix"}              | ${(timeZone: string) => startOfUnix(FIRST_INSTANT_MS + 10_000, "second", { timeZone })}                                     | ${null}  | ${FIRST_INSTANT_MS + 10_000}
    ${"endOfUnix"}                | ${(timeZone: string) => endOfUnix(FIRST_INSTANT_MS, "day", { timeZone })}                                                   | ${null}  | ${FIRST_INSTANT_MS + NEXT_MINUTE_MS - 1}
    ${"addUnix"}                  | ${(timeZone: string) => addUnix(FIRST_INSTANT_MS, { days: 1 }, { timeZone })}                                               | ${null}  | ${FIRST_INSTANT_MS + DAY_MS}
    ${"subtractUnix"}             | ${(timeZone: string) => subtractUnix(FIRST_INSTANT_MS + DAY_MS, { days: 1 }, { timeZone })}                                 | ${null}  | ${FIRST_INSTANT_MS}
    ${"intervalFromDurationUnix"} | ${(timeZone: string) => intervalFromDurationUnix(FIRST_INSTANT_MS + DAY_MS, "P1D", "end", { timeZone })}                    | ${null}  | ${{ start: FIRST_INSTANT_MS, end: FIRST_INSTANT_MS + DAY_MS }}
    ${"splitIntervalByUnitUnix"}  | ${(timeZone: string) => splitIntervalByUnitUnix(FIRST_INSTANT_MS, FIRST_INSTANT_MS + 2 * HOUR_MS, "hour", 1, { timeZone })} | ${[]}    | ${[{ start: FIRST_INSTANT_MS, end: FIRST_INSTANT_MS + HOUR_MS }, { start: FIRST_INSTANT_MS + HOUR_MS, end: FIRST_INSTANT_MS + 2 * HOUR_MS }]}
    ${"addOperatingTime"}         | ${(timeZone: string) => addOperatingTime(at(FIRST_INSTANT_MS + 10_000), "PT5S", alwaysOpen(timeZone))}                      | ${""}    | ${"-271821-04-20T00:00:15Z"}
    ${"freeTimeExpiry"}           | ${(timeZone: string) => freeTimeExpiry(at(FIRST_INSTANT_MS + 10_000), 1, freeTime(timeZone))}                               | ${null}  | ${{ freeTimeStart: "-271821-04-19", lastFreeDay: "-271821-04-19", expiresAt: "-271821-04-20T00:45:00Z" }}
  `(
    "$name returns its sentinel at -00:44:30 in the first 30 seconds of the range, and a value at -00:45",
    ({ call, sentinel, atMinuteOffset }) => {
      expect(call("-00:44:30")).toEqual(sentinel);
      expect(call("-00:45")).toEqual(atMinuteOffset);
    },
  );

  // Where no offset can answer, the two agree, so these have no row above:
  // - West of UTC the first instant's local date is -271821-04-19, which Temporal refuses to
  //   round or set to the second (TC39 CheckISODaysRange), and whose hour began before the first
  //   instant.
  // - East of UTC a clock that starts on the last local day has free time that ends on the next,
  //   past the last instant.
  it.each`
    name             | call
    ${"roundUnix"}   | ${(timeZone: string) => roundUnix(FIRST_INSTANT_MS + 400, { smallestUnit: "second", timeZone })}
    ${"setUnix"}     | ${(timeZone: string) => setUnix(FIRST_INSTANT_MS, { millisecond: 0 }, { timeZone })}
    ${"floorToZone"} | ${(timeZone: string) => floorToZone(at(FIRST_INSTANT_MS + 10_000), "hour", timeZone)}
    ${"bucketRange"} | ${(timeZone: string) => bucketRange(first, at(FIRST_INSTANT_MS + 2 * HOUR_MS), "hour", timeZone)}
  `(
    "$name returns its sentinel at the first instant at -00:44:30 and at -00:45 alike",
    ({ call }) => {
      expect(call("-00:44:30")).toEqual(call("-00:45"));
      expect([null, "", []]).toContainEqual(call("-00:45"));
    },
  );

  it("freeTimeExpiry returns null on the last local day at +00:44:30 and at +00:45 alike", () => {
    const clockStart = at(LAST_INSTANT_MS - 10_000);

    expect(freeTimeExpiry(clockStart, 1, freeTime("+00:44:30"))).toBeNull();
    expect(freeTimeExpiry(clockStart, 1, freeTime("+00:45"))).toBeNull();
  });

  // The window is the offset's seconds and no more, to the millisecond, whatever its hours and
  // minutes. Thirty seconds before the last instant the stand-in is the last instant itself.
  it.each`
    timeZone       | value                        | expected
    ${"+00:00:30"} | ${LAST_INSTANT_MS - 30_000}  | ${LAST_INSTANT_MS - 30_000}
    ${"+00:00:30"} | ${LAST_INSTANT_MS - 29_999}  | ${null}
    ${"+00:44:30"} | ${LAST_INSTANT_MS - 30_000}  | ${LAST_INSTANT_MS - 30_000}
    ${"+00:44:30"} | ${LAST_INSTANT_MS - 29_999}  | ${null}
    ${"+00:45"}    | ${LAST_INSTANT_MS - 29_999}  | ${LAST_INSTANT_MS - 30_000}
    ${"+00:44"}    | ${LAST_INSTANT_MS - 29_999}  | ${LAST_INSTANT_MS - 30_000}
    ${"+23:59:59"} | ${LAST_INSTANT_MS - 59_000}  | ${LAST_INSTANT_MS - 59_000}
    ${"+23:59:59"} | ${LAST_INSTANT_MS - 58_999}  | ${null}
    ${"+02:10:08"} | ${LAST_INSTANT_MS - 8_000}   | ${LAST_INSTANT_MS - 8_000}
    ${"+02:10:08"} | ${LAST_INSTANT_MS - 7_999}   | ${null}
    ${"-00:00:30"} | ${FIRST_INSTANT_MS + 30_000} | ${FIRST_INSTANT_MS + 30_000}
    ${"-00:00:30"} | ${FIRST_INSTANT_MS + 29_999} | ${null}
    ${"-00:44:30"} | ${FIRST_INSTANT_MS + 30_000} | ${FIRST_INSTANT_MS + 30_000}
    ${"-00:44:30"} | ${FIRST_INSTANT_MS + 29_999} | ${null}
    ${"-00:45"}    | ${FIRST_INSTANT_MS + 29_999} | ${FIRST_INSTANT_MS + 29_000}
    ${"-00:44"}    | ${FIRST_INSTANT_MS + 29_999} | ${FIRST_INSTANT_MS + 29_000}
    ${"-23:59:59"} | ${FIRST_INSTANT_MS + 59_000} | ${FIRST_INSTANT_MS + 59_000}
    ${"-23:59:59"} | ${FIRST_INSTANT_MS + 58_999} | ${null}
    ${"-03:30:52"} | ${FIRST_INSTANT_MS + 52_000} | ${FIRST_INSTANT_MS + 52_000}
    ${"-03:30:52"} | ${FIRST_INSTANT_MS + 51_999} | ${null}
  `(
    "startOfUnix returns $expected for the second of $value at $timeZone, at the edge of the limit",
    ({ timeZone, value, expected }) => {
      expect(startOfUnix(value, "second", { timeZone })).toBe(expected);
    },
  );

  // The other end of the range has no limit: a stand-in east of UTC is later than its instant
  // and one west is earlier, so each stays inside at the far end.
  it.each`
    timeZone       | value               | unit        | expected                                        | reason
    ${"-00:44:30"} | ${LAST_INSTANT_MS}  | ${"day"}    | ${LAST_INSTANT_MS - DAY_MS + LOCAL_MIDNIGHT_MS} | ${"23:15:30 local on 12 September"}
    ${"-00:44:30"} | ${LAST_INSTANT_MS}  | ${"second"} | ${LAST_INSTANT_MS}                              | ${"a whole second"}
    ${"+00:44:30"} | ${FIRST_INSTANT_MS} | ${"second"} | ${FIRST_INSTANT_MS}                             | ${"a whole second"}
    ${"+00:44:30"} | ${FIRST_INSTANT_MS} | ${"hour"}   | ${null}                                         | ${"00:44:30 local: its hour began before the first instant"}
    ${"+00:45"}    | ${FIRST_INSTANT_MS} | ${"hour"}   | ${null}                                         | ${"the same at the minute offset"}
  `(
    "startOfUnix returns $expected for the $unit of $value at $timeZone ($reason)",
    ({ timeZone, value, unit, expected }) => {
      expect(startOfUnix(value, unit, { timeZone })).toBe(expected);
    },
  );

  // calendar/hours at the first instant. The walk looks three days back, and at the first
  // instant it starts from the earliest instant that can be placed. An offset west of UTC answers
  // from its seconds after the first instant on, as every other function does.
  // The schedule that never closes: five seconds of open time after an instant is that instant
  // plus five seconds.
  it.each`
    after         | timeZone       | open     | fiveSecondsLater
    ${0}          | ${"-00:44:30"} | ${false} | ${""}
    ${29_999}     | ${"-00:44:30"} | ${false} | ${""}
    ${30_000}     | ${"-00:44:30"} | ${true}  | ${"-271821-04-20T00:00:35Z"}
    ${DAY_MS}     | ${"-00:44:30"} | ${true}  | ${"-271821-04-21T00:00:05Z"}
    ${3 * DAY_MS} | ${"-00:44:30"} | ${true}  | ${"-271821-04-23T00:00:05Z"}
    ${0}          | ${"-00:44"}    | ${true}  | ${"-271821-04-20T00:00:05Z"}
    ${0}          | ${"-00:45"}    | ${true}  | ${"-271821-04-20T00:00:05Z"}
    ${29_999}     | ${"-00:00:30"} | ${false} | ${""}
    ${30_000}     | ${"-00:00:30"} | ${true}  | ${"-271821-04-20T00:00:35Z"}
    ${0}          | ${"+00:44:30"} | ${true}  | ${"-271821-04-20T00:00:05Z"}
  `(
    "isOpenAt returns $open and addOperatingTime $fiveSecondsLater, $after ms after the first instant at $timeZone",
    ({ after, timeZone, open, fiveSecondsLater }) => {
      const instant = at(FIRST_INSTANT_MS + after);

      expect(isOpenAt(instant, alwaysOpen(timeZone))).toBe(open);
      expect(addOperatingTime(instant, "PT5S", alwaysOpen(timeZone))).toBe(
        fiveSecondsLater,
      );
    },
  );

  // Thirty seconds after the first instant is 23:16:00 local on 19 April at -00:44:30. The
  // 08:00 to 17:00 window of 20 April is 08:44:30Z to 17:44:30Z; the window of the 19th ended
  // before the first instant.
  it("the seven calendar/hours functions answer from the offset's seconds after the first instant", () => {
    const from = at(FIRST_INSTANT_MS + 30_000);
    const day = { start: from, end: at(FIRST_INSTANT_MS + 30_000 + DAY_MS) };
    const window = {
      start: "-271821-04-20T08:44:30Z",
      end: "-271821-04-20T17:44:30Z",
    };
    const hours = businessHours("-00:44:30");

    expect(isOpenAt(from, hours)).toBe(false);
    expect(isOpenAt(window.start, hours)).toBe(true);
    expect(nextOpenAt(from, hours)).toBe(window.start);
    expect(nextCloseAt(window.start, hours)).toBe(window.end);
    expect(addOperatingTime(from, "PT10H", hours)).toBe(
      "-271821-04-21T09:44:30Z",
    );
    expect(operatingIntervals(hours, day)).toEqual([window]);
    expect(recurringWindows(hours.weekly, day, "-00:44:30")).toEqual([window]);
    expect(operatingTimeBetween(day.start, day.end, hours)).toBe("PT9H");
  });

  // Inside the first 30 seconds every one of the seven returns its sentinel, and the minute
  // offset next to it answers.
  it("the seven calendar/hours functions return their sentinel in the first seconds at -00:44:30", () => {
    const from = at(FIRST_INSTANT_MS + 29_999);
    const day = { start: from, end: at(FIRST_INSTANT_MS + DAY_MS) };
    const hours = businessHours("-00:44:30");
    const atMinute = businessHours("-00:45");

    expect(isOpenAt(from, alwaysOpen("-00:44:30"))).toBe(false);
    expect(nextOpenAt(from, hours)).toBe("");
    expect(nextCloseAt(from, hours)).toBe("");
    expect(addOperatingTime(from, "PT10H", hours)).toBe("");
    expect(operatingIntervals(hours, day)).toEqual([]);
    expect(recurringWindows(hours.weekly, day, "-00:44:30")).toEqual([]);
    expect(operatingTimeBetween(day.start, day.end, hours)).toBe("");

    // At -00:45 the 08:00 to 17:00 window of 20 April is 08:45:00Z to 17:45:00Z.
    expect(isOpenAt(from, alwaysOpen("-00:45"))).toBe(true);
    expect(nextOpenAt(from, atMinute)).toBe("-271821-04-20T08:45:00Z");
    expect(operatingIntervals(atMinute, day)).toEqual([
      { start: "-271821-04-20T08:45:00Z", end: "-271821-04-20T17:45:00Z" },
    ]);
    expect(operatingTimeBetween(day.start, day.end, atMinute)).toBe("PT9H");
  });

  // At the last instant only the three that search forward place their instant; the other four
  // walk from three days back and read the rest.
  it("calendar/hours at the last instant at +00:44:30", () => {
    const from = at(LAST_INSTANT_MS - 10_000);
    const hour = { start: at(LAST_INSTANT_MS - HOUR_MS), end: last };

    expect(addOperatingTime(from, "PT5S", alwaysOpen("+00:44:30"))).toBe("");
    expect(nextOpenAt(from, alwaysOpen("+00:44:30"))).toBe("");
    expect(
      nextCloseAt(at(LAST_INSTANT_MS - 30_000), businessHours("+00:44:30")),
    ).toBe(at(LAST_INSTANT_MS - 30_000));
    expect(nextOpenAt(from, alwaysOpen("+00:45"))).toBe(from);

    expect(isOpenAt(last, alwaysOpen("+00:44:30"))).toBe(true);
    expect(operatingIntervals(alwaysOpen("+00:44:30"), hour)).toEqual([hour]);
    expect(
      recurringWindows(everyDay("00:00", "00:00"), hour, "+00:44:30"),
    ).toEqual([hour]);
    expect(
      operatingTimeBetween(hour.start, hour.end, alwaysOpen("+00:44:30")),
    ).toBe("PT1H");
  });

  // Every function that only reads has no limit at either end.
  it("reads the local wall clock at both limits", () => {
    expect(
      unixParse.parseTimeFromUnix(LAST_INSTANT_MS, { timeZone: "+00:44:30" }),
    ).toBe("00:44:30");
    expect(
      convertUnixToPlainDateTime(FIRST_INSTANT_MS, { timeZone: "-00:44:30" }),
    ).toBe("-271821-04-19T23:15:30");
  });
});
