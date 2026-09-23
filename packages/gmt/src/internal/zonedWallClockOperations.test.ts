import { Temporal } from "@js-temporal/polyfill";
import { dateLineCrossingTimeZones } from "../test/timeZoneMatrix";
import {
  addToZoned,
  plainToZoned,
  roundZonedDateTime,
  subtractFromZoned,
  withZonedFields,
  zonedHoursInDay,
  zonedNextTransition,
  zonedPreviousTransition,
  zonedStartOfDay,
  zonedWithPlainTime,
} from "./zonedWallClockOperations";

// Epoch nanoseconds of the last representable instant, +275760-09-13T00:00:00Z (TC39 nsMaxInstant).
const MAX_INSTANT = 8_640_000_000_000_000_000_000n;
const HOUR = 3_600_000_000_000n;
const DAY = 24n * HOUR;

/** Built from an exact time, so no wall clock is resolved: an independent oracle at the limits. */
const at = (epochNanoseconds: bigint, timeZone: string) =>
  new Temporal.ZonedDateTime(epochNanoseconds, timeZone);

/*
 * America/Santiago's last transitions before the maximum are +275760-04-06T03:00Z (-03:00 -> -04:00)
 * and +275760-09-07T04:00Z (-04:00 -> -03:00): tzdata's Chile rules "Apr Sun>=2 3:00u" and
 * "Sep Sun>=2 4:00u", both Sundays in 275760. The September change skips local midnight, so
 * 7 September starts at 01:00 -03:00 and runs 23 hours to 8 September 00:00 -03:00 (03:00Z).
 */
const SANTIAGO_SEPTEMBER_TRANSITION = MAX_INSTANT - 6n * DAY + 4n * HOUR;

describe("plainToZoned", () => {
  it.each`
    plain                           | timeZone                | disambiguation  | expected
    ${"+275760-09-13T10:00:00"}     | ${"Australia/Sydney"}   | ${"compatible"} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${"+275760-09-13T10:00:00"}     | ${"Australia/Sydney"}   | ${"reject"}     | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${"+275760-09-13T14:00:00"}     | ${"Pacific/Kiritimati"} | ${"compatible"} | ${"+275760-09-13T14:00:00+14:00[Pacific/Kiritimati]"}
    ${"+275760-09-13T00:00:00.001"} | ${"Europe/Paris"}       | ${"compatible"} | ${"+275760-09-13T00:00:00.001+02:00[Europe/Paris]"}
    ${"-271821-04-19T20:00:00"}     | ${"America/New_York"}   | ${"compatible"} | ${"-271821-04-19T20:00:00-04:56[America/New_York]"}
  `(
    "resolves PlainDateTime $plain in $timeZone (disambiguation=$disambiguation) to $expected",
    ({ plain, timeZone, disambiguation, expected }) => {
      expect(
        plainToZoned(
          Temporal.PlainDateTime.from(plain),
          timeZone,
          disambiguation,
        ).toString(),
      ).toBe(expected);
    },
  );

  it.each`
    plain              | timeZone              | expected                                            | reason
    ${"+275760-09-07"} | ${"America/Santiago"} | ${"+275760-09-07T01:00:00-03:00[America/Santiago]"} | ${"midnight skipped: day starts at the transition"}
    ${"+275760-09-13"} | ${"Australia/Sydney"} | ${"+275760-09-13T00:00:00+10:00[Australia/Sydney]"} | ${"last Sydney day starts at 00:00"}
    ${"+275760-09-07"} | ${"America/New_York"} | ${"+275760-09-07T00:00:00-04:00[America/New_York]"} | ${"no transition that day"}
  `(
    "resolves PlainDate $plain in $timeZone to $expected ($reason)",
    ({ plain, timeZone, expected }) => {
      expect(
        plainToZoned(Temporal.PlainDate.from(plain), timeZone).toString(),
      ).toBe(expected);
    },
  );

  it("confirms the Santiago transition oracle", () => {
    expect(
      at(SANTIAGO_SEPTEMBER_TRANSITION, "America/Santiago").toString(),
    ).toBe("+275760-09-07T01:00:00-03:00[America/Santiago]");
    expect(
      at(SANTIAGO_SEPTEMBER_TRANSITION - 1n, "America/Santiago").offset,
    ).toBe("-04:00");
  });

  it.each`
    plain                                 | timeZone                | reason
    ${"+275760-09-13T10:00:00.000000001"} | ${"Australia/Sydney"}   | ${"1ns past the maximum"}
    ${"+275760-09-13T14:30:00"}           | ${"Pacific/Kiritimati"} | ${"30min past the maximum"}
  `("throws for $plain in $timeZone ($reason)", ({ plain, timeZone }) => {
    expect(() =>
      plainToZoned(Temporal.PlainDateTime.from(plain), timeZone),
    ).toThrow(RangeError);
  });

  it.each`
    plain                    | disambiguation
    ${"2024-03-10T02:30:00"} | ${"compatible"}
    ${"2024-03-10T02:30:00"} | ${"earlier"}
    ${"2024-03-10T02:30:00"} | ${"later"}
    ${"2024-11-03T01:30:00"} | ${"earlier"}
    ${"2024-11-03T01:30:00"} | ${"later"}
  `(
    "matches Temporal in the normal range for $plain (disambiguation=$disambiguation)",
    ({ plain, disambiguation }) => {
      const wall = Temporal.PlainDateTime.from(plain);
      expect(
        plainToZoned(wall, "America/New_York", disambiguation).toString(),
      ).toBe(
        wall.toZonedDateTime("America/New_York", { disambiguation }).toString(),
      );
    },
  );
});

describe("zonedStartOfDay and zonedWithPlainTime", () => {
  it.each`
    epochNanoseconds                              | timeZone              | expected                                            | reason
    ${SANTIAGO_SEPTEMBER_TRANSITION + 11n * HOUR} | ${"America/Santiago"} | ${"+275760-09-07T01:00:00-03:00[America/Santiago]"} | ${"midnight skipped near the maximum"}
    ${MAX_INSTANT}                                | ${"Australia/Sydney"} | ${"+275760-09-13T00:00:00+10:00[Australia/Sydney]"} | ${"Sydney maximum"}
  `(
    "starts the day of $epochNanoseconds in $timeZone at $expected ($reason)",
    ({ epochNanoseconds, timeZone, expected }) => {
      const zoned = at(epochNanoseconds, timeZone);
      expect(zonedStartOfDay(zoned).toString()).toBe(expected);
      expect(zonedWithPlainTime(zoned).toString()).toBe(expected);
    },
  );

  it.each`
    epochNanoseconds | timeZone                | time       | expected
    ${MAX_INSTANT}   | ${"Australia/Sydney"}   | ${"05:00"} | ${"+275760-09-13T05:00:00+10:00[Australia/Sydney]"}
    ${MAX_INSTANT}   | ${"Pacific/Kiritimati"} | ${"13:59"} | ${"+275760-09-13T13:59:00+14:00[Pacific/Kiritimati]"}
  `(
    "sets $time on the day of $epochNanoseconds in $timeZone to $expected",
    ({ epochNanoseconds, timeZone, time, expected }) => {
      expect(
        zonedWithPlainTime(at(epochNanoseconds, timeZone), time).toString(),
      ).toBe(expected);
    },
  );

  it("throws for a time past the maximum on the last Sydney day", () => {
    expect(() =>
      zonedWithPlainTime(at(MAX_INSTANT, "Australia/Sydney"), "10:00:01"),
    ).toThrow(RangeError);
  });
});

describe("zonedHoursInDay", () => {
  it.each`
    epochNanoseconds                              | timeZone              | expected | reason
    ${SANTIAGO_SEPTEMBER_TRANSITION + 11n * HOUR} | ${"America/Santiago"} | ${23}    | ${"7 Sep starts 04:00Z, 8 Sep starts 03:00Z"}
    ${MAX_INSTANT - 12n * HOUR}                   | ${"UTC"}              | ${24}    | ${"the next UTC day starts exactly at the maximum"}
  `(
    "returns $expected for $epochNanoseconds in $timeZone ($reason)",
    ({ epochNanoseconds, timeZone, expected }) => {
      expect(zonedHoursInDay(at(epochNanoseconds, timeZone))).toBe(expected);
    },
  );

  it.each`
    timeZone                | reason
    ${"Australia/Sydney"}   | ${"14 Sep 00:00 +10:00 is past the maximum"}
    ${"Pacific/Kiritimati"} | ${"14 Sep 00:00 +14:00 is past the maximum"}
  `("throws on the last day in $timeZone ($reason)", ({ timeZone }) => {
    expect(() => zonedHoursInDay(at(MAX_INSTANT, timeZone))).toThrow(
      RangeError,
    );
  });
});

describe("zonedNextTransition", () => {
  it.each`
    epochNanoseconds                      | timeZone              | expected                                            | reason
    ${MAX_INSTANT - 12n * DAY}            | ${"America/Santiago"} | ${"+275760-09-07T01:00:00-03:00[America/Santiago]"} | ${"transition 6 days before the maximum"}
    ${SANTIAGO_SEPTEMBER_TRANSITION - 1n} | ${"America/Santiago"} | ${"+275760-09-07T01:00:00-03:00[America/Santiago]"} | ${"1ns before the transition"}
    ${MAX_INSTANT - 200n * DAY}           | ${"America/Santiago"} | ${"+275760-04-05T23:00:00-04:00[America/Santiago]"} | ${"April transition, far from the maximum"}
  `(
    "finds $expected after $epochNanoseconds in $timeZone ($reason)",
    ({ epochNanoseconds, timeZone, expected }) => {
      expect(
        zonedNextTransition(at(epochNanoseconds, timeZone))?.toString(),
      ).toBe(expected);
    },
  );

  it.each`
    epochNanoseconds                 | timeZone                | reason
    ${SANTIAGO_SEPTEMBER_TRANSITION} | ${"America/Santiago"}   | ${"the September change is the last before the maximum"}
    ${MAX_INSTANT - 24n * DAY}       | ${"America/New_York"}   | ${"New York's next change is in November"}
    ${MAX_INSTANT - DAY}             | ${"Pacific/Kiritimati"} | ${"no changes since 1995"}
    ${MAX_INSTANT - DAY}             | ${"UTC"}                | ${"UTC never changes"}
  `(
    "returns null after $epochNanoseconds in $timeZone ($reason)",
    ({ epochNanoseconds, timeZone }) => {
      expect(zonedNextTransition(at(epochNanoseconds, timeZone))).toBeNull();
    },
  );
});

describe("addToZoned and subtractFromZoned", () => {
  // TC39 AddZonedDateTime: calendar units move the wall clock, which is then resolved with
  // "compatible"; time units are added to the exact time.
  it.each`
    epochNanoseconds            | timeZone                | duration         | expected
    ${MAX_INSTANT - DAY}        | ${"Australia/Sydney"}   | ${{ days: 1 }}   | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${MAX_INSTANT - DAY}        | ${"Pacific/Kiritimati"} | ${{ days: 1 }}   | ${"+275760-09-13T14:00:00+14:00[Pacific/Kiritimati]"}
    ${MAX_INSTANT - 31n * DAY}  | ${"Australia/Sydney"}   | ${{ months: 1 }} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${MAX_INSTANT - 7n * DAY}   | ${"Australia/Sydney"}   | ${{ weeks: 1 }}  | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${MAX_INSTANT - DAY - HOUR} | ${"Australia/Sydney"}   | ${"P1DT1H"}      | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
  `(
    "adds $duration to $epochNanoseconds in $timeZone giving $expected",
    ({ epochNanoseconds, timeZone, duration, expected }) => {
      const zoned = at(epochNanoseconds, timeZone);
      expect(addToZoned(zoned, duration).toString()).toBe(expected);
      expect(
        subtractFromZoned(
          zoned,
          Temporal.Duration.from(duration).negated(),
        ).toString(),
      ).toBe(expected);
    },
  );

  it.each`
    epochNanoseconds | timeZone              | duration
    ${MAX_INSTANT}   | ${"Australia/Sydney"} | ${{ days: 1 }}
    ${MAX_INSTANT}   | ${"Australia/Sydney"} | ${{ hours: 1 }}
    ${MAX_INSTANT}   | ${"Australia/Sydney"} | ${{ nanoseconds: 1 }}
  `(
    "throws when $duration leaves the range from $epochNanoseconds in $timeZone",
    ({ epochNanoseconds, timeZone, duration }) => {
      expect(() =>
        addToZoned(at(epochNanoseconds, timeZone), duration),
      ).toThrow(RangeError);
    },
  );

  it("matches Temporal across a normal-range spring-forward", () => {
    const zoned = Temporal.ZonedDateTime.from(
      "2024-03-09T02:30:00-05:00[America/New_York]",
    );
    expect(addToZoned(zoned, { days: 1 }).toString()).toBe(
      zoned.add({ days: 1 }).toString(),
    );
  });
});

describe("withZonedFields", () => {
  // TC39 ZonedDateTime#with: the merged wall clock is resolved with the receiver's offset
  // ("prefer" by default), which Sydney keeps all of September.
  it.each`
    epochNanoseconds           | fields         | options                 | expected
    ${MAX_INSTANT - 2n * HOUR} | ${{ hour: 9 }} | ${undefined}            | ${"+275760-09-13T09:00:00+10:00[Australia/Sydney]"}
    ${MAX_INSTANT - DAY}       | ${{ day: 13 }} | ${undefined}            | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${MAX_INSTANT - DAY}       | ${{ day: 13 }} | ${{ offset: "ignore" }} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${MAX_INSTANT - DAY}       | ${{ day: 13 }} | ${{ offset: "reject" }} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
  `(
    "sets $fields on $epochNanoseconds in Sydney (options=$options) giving $expected",
    ({ epochNanoseconds, fields, options, expected }) => {
      expect(
        withZonedFields(
          at(epochNanoseconds, "Australia/Sydney"),
          fields,
          options,
        ).toString(),
      ).toBe(expected);
    },
  );

  it("throws when the new wall clock is past the maximum", () => {
    expect(() =>
      withZonedFields(at(MAX_INSTANT, "Australia/Sydney"), { hour: 11 }),
    ).toThrow(RangeError);
  });
});

describe("roundZonedDateTime", () => {
  it.each`
    epochNanoseconds                              | timeZone              | roundTo                                              | expected
    ${MAX_INSTANT - HOUR / 2n}                    | ${"Australia/Sydney"} | ${{ smallestUnit: "hour" }}                          | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}
    ${MAX_INSTANT - 30_000_000_000n}              | ${"Australia/Sydney"} | ${{ smallestUnit: "minute", roundingMode: "floor" }} | ${"+275760-09-13T09:59:00+10:00[Australia/Sydney]"}
    ${SANTIAGO_SEPTEMBER_TRANSITION + 11n * HOUR} | ${"America/Santiago"} | ${{ smallestUnit: "day" }}                           | ${"+275760-09-07T01:00:00-03:00[America/Santiago]"}
    ${SANTIAGO_SEPTEMBER_TRANSITION + 12n * HOUR} | ${"America/Santiago"} | ${{ smallestUnit: "day" }}                           | ${"+275760-09-08T00:00:00-03:00[America/Santiago]"}
    ${SANTIAGO_SEPTEMBER_TRANSITION + 12n * HOUR} | ${"America/Santiago"} | ${{ smallestUnit: "day", roundingMode: "floor" }}    | ${"+275760-09-07T01:00:00-03:00[America/Santiago]"}
    ${SANTIAGO_SEPTEMBER_TRANSITION + HOUR}       | ${"America/Santiago"} | ${{ smallestUnit: "day", roundingMode: "ceil" }}     | ${"+275760-09-08T00:00:00-03:00[America/Santiago]"}
  `(
    "rounds $epochNanoseconds in $timeZone with $roundTo to $expected",
    ({ epochNanoseconds, timeZone, roundTo, expected }) => {
      expect(
        roundZonedDateTime(at(epochNanoseconds, timeZone), roundTo).toString(),
      ).toBe(expected);
    },
  );

  it("confirms the Santiago day-rounding arithmetic: 11h of a 23h day rounds down, 12h rounds up", () => {
    expect(
      at(
        SANTIAGO_SEPTEMBER_TRANSITION + 23n * HOUR,
        "America/Santiago",
      ).toString(),
    ).toBe("+275760-09-08T00:00:00-03:00[America/Santiago]");
  });

  it("throws rounding the last Sydney day to a day (the next day starts past the maximum)", () => {
    expect(() =>
      roundZonedDateTime(at(MAX_INSTANT, "Australia/Sydney"), {
        smallestUnit: "day",
      }),
    ).toThrow(RangeError);
  });
});

describe("roundZonedDateTime to a day, every rounding mode", () => {
  // TC39 RoundTimeDurationToIncrement over America/Santiago's 23-hour 7 Sep 275760 (it starts at
  // the 04:00Z transition): 11h30m of progress is an exact half. Half-ceil and half-expand go up;
  // half-floor, half-trunc and half-even (quotient 0 is even) stay; ceil and expand move any
  // positive progress up; floor and trunc never do. Zero progress stays at the start in every mode.
  const start = "+275760-09-07T01:00:00-03:00[America/Santiago]";
  const nextStart = "+275760-09-08T00:00:00-03:00[America/Santiago]";
  const HALF_DAY = 11n * HOUR + HOUR / 2n;

  it.each`
    progress         | roundingMode    | expected
    ${HALF_DAY}      | ${"halfExpand"} | ${nextStart}
    ${HALF_DAY}      | ${"halfCeil"}   | ${nextStart}
    ${HALF_DAY}      | ${"halfFloor"}  | ${start}
    ${HALF_DAY}      | ${"halfTrunc"}  | ${start}
    ${HALF_DAY}      | ${"halfEven"}   | ${start}
    ${HALF_DAY + 1n} | ${"halfFloor"}  | ${nextStart}
    ${HALF_DAY - 1n} | ${"halfCeil"}   | ${start}
    ${1n}            | ${"expand"}     | ${nextStart}
    ${1n}            | ${"ceil"}       | ${nextStart}
    ${22n * HOUR}    | ${"trunc"}      | ${start}
    ${22n * HOUR}    | ${"floor"}      | ${start}
    ${0n}            | ${"ceil"}       | ${start}
    ${0n}            | ${"halfExpand"} | ${start}
  `(
    "rounds $progress ns into the day with $roundingMode to $expected",
    ({ progress, roundingMode, expected }) => {
      expect(
        roundZonedDateTime(
          at(SANTIAGO_SEPTEMBER_TRANSITION + progress, "America/Santiago"),
          { smallestUnit: "day", roundingMode },
        ).toString(),
      ).toBe(expected);
    },
  );
});

describe("the 1844 date-line crossings (zoned.E)", () => {
  // Each zone jumps a whole day forward at local 1844-12-31T00:00 in its LMT offset, so
  // 1844-12-31 never happened and 1845-01-01T00:00 in the new offset is the transition itself.
  // Expected values: Chromium 153 native Temporal. The polyfill's transition search starts at
  // 1847-01-01 and misses these (js-temporal/temporal-polyfill#372).
  const MIN_INSTANT = -MAX_INSTANT;
  const epochOf = (instant: string) =>
    Temporal.Instant.from(instant).epochNanoseconds;
  // The transition built from its exact time: the constructor resolves no wall clock.
  const crossings = dateLineCrossingTimeZones.map(({ timeZone, instant }) => ({
    timeZone,
    epoch: epochOf(instant),
    crossing: at(epochOf(instant), timeZone).toString(),
  }));

  it.each(crossings)(
    "confirms the $timeZone crossing oracle reads $crossing",
    ({ timeZone, epoch }) => {
      expect(at(epoch, timeZone).toPlainDateTime().toString()).toBe(
        "1845-01-01T00:00:00",
      );
      expect(
        at(epoch - 1n, timeZone)
          .toPlainDateTime()
          .toString(),
      ).toBe("1844-12-30T23:59:59.999999999");
    },
  );

  describe("zonedNextTransition", () => {
    it.each(crossings)(
      "finds $crossing in $timeZone from 1800, from 1ns before it and from the minimum instant",
      ({ timeZone, epoch, crossing }) => {
        for (const from of [
          epochOf("1800-01-01T00:00:00Z"),
          epoch - 1n,
          MIN_INSTANT,
        ]) {
          expect(zonedNextTransition(at(from, timeZone))?.toString()).toBe(
            crossing,
          );
        }
      },
    );

    it.each`
      from                      | timeZone              | expected                                         | reason
      ${"1844-12-31T15:56:08Z"} | ${"Asia/Manila"}      | ${"1899-09-06T12:00:00+08:00[Asia/Manila]"}      | ${"from the crossing itself, the polyfill's own answer"}
      ${"1846-01-01T00:00:00Z"} | ${"Europe/London"}    | ${"1847-12-01T00:01:15+00:00[Europe/London]"}    | ${"pre-1847, no earlier change: the polyfill's answer"}
      ${"1800-01-01T00:00:00Z"} | ${"America/New_York"} | ${"1883-11-18T12:00:00-05:00[America/New_York]"} | ${"pre-1847, no earlier change: the polyfill's answer"}
      ${"2026-01-01T00:00:00Z"} | ${"America/New_York"} | ${"2026-03-08T03:00:00-04:00[America/New_York]"} | ${"after the floor: never re-checked"}
      ${"1800-01-01T00:00:00Z"} | ${"Asia/Tokyo"}       | ${"1888-01-01T00:00:00+09:00[Asia/Tokyo]"}       | ${"pre-1847, first change in 1888"}
    `(
      "finds $expected after $from in $timeZone ($reason)",
      ({ from, timeZone, expected }) => {
        expect(
          zonedNextTransition(at(epochOf(from), timeZone))?.toString(),
        ).toBe(expected);
      },
    );

    it.each`
      from                      | timeZone        | reason
      ${"2026-01-01T00:00:00Z"} | ${"Asia/Tokyo"} | ${"no change since 1951"}
      ${"1800-01-01T00:00:00Z"} | ${"UTC"}        | ${"UTC never changes"}
      ${"1800-01-01T00:00:00Z"} | ${"+10:00"}     | ${"an offset zone never changes"}
    `(
      "returns null after $from in $timeZone ($reason)",
      ({ from, timeZone }) => {
        expect(zonedNextTransition(at(epochOf(from), timeZone))).toBeNull();
      },
    );
  });

  describe("zonedPreviousTransition", () => {
    it.each(crossings)(
      "finds $crossing in $timeZone from 1ns after it, from 1846 and from 1848",
      ({ timeZone, epoch, crossing }) => {
        for (const from of [
          epoch + 1n,
          epochOf("1846-01-01T00:00:00Z"),
          epochOf("1848-01-01T00:00:00Z"),
        ]) {
          expect(zonedPreviousTransition(at(from, timeZone))?.toString()).toBe(
            crossing,
          );
        }
      },
    );

    it.each`
      from                      | timeZone              | expected                                         | reason
      ${"1900-01-01T00:00:00Z"} | ${"Asia/Manila"}      | ${"1899-09-06T12:00:00+08:00[Asia/Manila]"}      | ${"a later change the polyfill finds"}
      ${"1900-01-01T00:00:00Z"} | ${"Pacific/Guam"}     | ${"1845-01-01T00:00:00+09:39[Pacific/Guam]"}     | ${"Guam's next change is in 1901"}
      ${"1848-01-01T00:00:00Z"} | ${"Europe/London"}    | ${"1847-12-01T00:01:15+00:00[Europe/London]"}    | ${"a change after the floor"}
      ${"1900-01-01T00:00:00Z"} | ${"America/New_York"} | ${"1883-11-18T12:00:00-05:00[America/New_York]"} | ${"a change after the floor"}
    `(
      "finds $expected before $from in $timeZone ($reason)",
      ({ from, timeZone, expected }) => {
        expect(
          zonedPreviousTransition(at(epochOf(from), timeZone))?.toString(),
        ).toBe(expected);
      },
    );

    it.each`
      from                      | timeZone              | reason
      ${"1844-06-01T00:00:00Z"} | ${"Asia/Manila"}      | ${"before the crossing, nothing earlier"}
      ${"1844-12-31T15:56:08Z"} | ${"Asia/Manila"}      | ${"previous is strict: the crossing itself is not before it"}
      ${"1850-01-01T00:00:00Z"} | ${"America/New_York"} | ${"New York's first change is in 1883"}
      ${"1900-01-01T00:00:00Z"} | ${"UTC"}              | ${"UTC never changes"}
      ${"1800-01-01T00:00:00Z"} | ${"+10:00"}           | ${"an offset zone never changes"}
    `(
      "returns null before $from in $timeZone ($reason)",
      ({ from, timeZone }) => {
        expect(zonedPreviousTransition(at(epochOf(from), timeZone))).toBeNull();
      },
    );

    it("returns null at the minimum instant", () => {
      expect(
        zonedPreviousTransition(at(MIN_INSTANT, "Asia/Manila")),
      ).toBeNull();
    });
  });

  describe("start of day", () => {
    it.each(crossings)(
      "gives 1844-12-30 and 1845-01-01 24 hours each in $timeZone",
      ({ timeZone, epoch }) => {
        // 1844-12-30T12:00 in the old offset, and 1845-01-01T12:00 in the new one.
        expect(zonedHoursInDay(at(epoch - 12n * HOUR, timeZone))).toBe(24);
        expect(zonedHoursInDay(at(epoch + 12n * HOUR, timeZone))).toBe(24);
      },
    );

    it.each(crossings)(
      "starts the skipped PlainDate 1844-12-31 in $timeZone at $crossing",
      ({ timeZone, crossing }) => {
        expect(
          plainToZoned(
            Temporal.PlainDate.from("1844-12-31"),
            timeZone,
          ).toString(),
        ).toBe(crossing);
      },
    );

    it.each(crossings)(
      "starts 1845-01-01 in $timeZone at $crossing (zonedStartOfDay, zonedWithPlainTime)",
      ({ timeZone, epoch, crossing }) => {
        const noon = at(epoch + 12n * HOUR, timeZone);
        expect(zonedStartOfDay(noon).toString()).toBe(crossing);
        expect(zonedWithPlainTime(noon).toString()).toBe(crossing);
      },
    );

    it.each(crossings)(
      "resolves PlainDateTime 1844-12-31T12:00 in $timeZone 24 hours forward, past the skipped day",
      ({ timeZone, epoch }) => {
        expect(
          plainToZoned(
            Temporal.PlainDateTime.from("1844-12-31T12:00"),
            timeZone,
          ).toString(),
        ).toBe(at(epoch + 12n * HOUR, timeZone).toString());
      },
    );

    // 1844-12-30 is 24 hours long, so its noon is an exact half: halfExpand goes up to the next
    // day's start (the crossing), halfFloor stays; 11:00 rounds down.
    it.each(crossings)(
      "rounds 1844-12-30 in $timeZone to a day",
      ({ timeZone, epoch, crossing }) => {
        const dayStart = at(epoch - 24n * HOUR, timeZone).toString();
        expect(
          roundZonedDateTime(at(epoch - 12n * HOUR, timeZone), {
            smallestUnit: "day",
          }).toString(),
        ).toBe(crossing);
        expect(
          roundZonedDateTime(at(epoch - 12n * HOUR, timeZone), {
            smallestUnit: "day",
            roundingMode: "halfFloor",
          }).toString(),
        ).toBe(dayStart);
        expect(
          roundZonedDateTime(at(epoch - 13n * HOUR, timeZone), {
            smallestUnit: "day",
          }).toString(),
        ).toBe(dayStart);
      },
    );

    it.each`
      from                      | timeZone              | expected
      ${"1846-06-01T12:01:15Z"} | ${"Europe/London"}    | ${24}
      ${"1847-12-01T12:00:00Z"} | ${"Europe/London"}    | ${23.979166666666668}
      ${"1883-11-18T17:00:00Z"} | ${"America/New_York"} | ${24.066111111111113}
    `(
      "measures the day of $from in $timeZone as $expected hours (control)",
      ({ from, timeZone, expected }) => {
        expect(zonedHoursInDay(at(epochOf(from), timeZone))).toBe(expected);
      },
    );
  });
});
