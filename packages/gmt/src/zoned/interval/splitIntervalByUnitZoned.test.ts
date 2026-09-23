import { calendarZonedFixtures } from "../../test";
import { Temporal } from "@js-temporal/polyfill";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { splitIntervalByUnitZoned } from "./splitIntervalByUnitZoned";

describe("splitIntervalByUnitZoned", () => {
  // Each boundary is start + k × amount (Temporal and Luxon Interval.splitBy), so month ends don't drift.
  it.each`
    start                                            | end                                              | unit       | expected
    ${"2024-01-31T10:00:00-05:00[America/New_York]"} | ${"2024-05-15T10:00:00-04:00[America/New_York]"} | ${"month"} | ${[{ start: "2024-01-31T10:00:00-05:00[America/New_York]", end: "2024-02-29T10:00:00-05:00[America/New_York]" }, { start: "2024-02-29T10:00:00-05:00[America/New_York]", end: "2024-03-31T10:00:00-04:00[America/New_York]" }, { start: "2024-03-31T10:00:00-04:00[America/New_York]", end: "2024-04-30T10:00:00-04:00[America/New_York]" }, { start: "2024-04-30T10:00:00-04:00[America/New_York]", end: "2024-05-15T10:00:00-04:00[America/New_York]" }]}
  `(
    "computes every $unit boundary of $start to $end from the start, without month-end drift",
    ({ start, end, unit, expected }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, 1)).toEqual(expected);
    },
  );

  // amount > 1 from a month end: step k is start + 3k months (2024-05-30), where stepping from
  // the clamped Feb 29 would drift to 2024-05-29. Verified against Temporal.ZonedDateTime.add.
  it.each`
    start                                            | end                                              | unit       | amount | expected
    ${"2023-11-30T10:00:00-05:00[America/New_York]"} | ${"2024-09-01T10:00:00-04:00[America/New_York]"} | ${"month"} | ${3}   | ${[{ start: "2023-11-30T10:00:00-05:00[America/New_York]", end: "2024-02-29T10:00:00-05:00[America/New_York]" }, { start: "2024-02-29T10:00:00-05:00[America/New_York]", end: "2024-05-30T10:00:00-04:00[America/New_York]" }, { start: "2024-05-30T10:00:00-04:00[America/New_York]", end: "2024-08-30T10:00:00-04:00[America/New_York]" }, { start: "2024-08-30T10:00:00-04:00[America/New_York]", end: "2024-09-01T10:00:00-04:00[America/New_York]" }]}
  `(
    "computes every $amount $unit boundary of $start to $end from the start",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  // Pacific/Apia deleted 30 December 2011 (UTC-10 → UTC+14). Day steps 1 and 2 from 29 December
  // both resolve to 31 December 12:00, so step 2 is skipped instead of discarding the whole split.
  // Verified against Temporal.ZonedDateTime.add.
  it.each`
    start                                        | end                                          | unit     | amount | expected
    ${"2011-12-29T12:00:00-10:00[Pacific/Apia]"} | ${"2012-01-01T12:00:00+14:00[Pacific/Apia]"} | ${"day"} | ${1}   | ${[{ start: "2011-12-29T12:00:00-10:00[Pacific/Apia]", end: "2011-12-31T12:00:00+14:00[Pacific/Apia]" }, { start: "2011-12-31T12:00:00+14:00[Pacific/Apia]", end: "2012-01-01T12:00:00+14:00[Pacific/Apia]" }]}
  `(
    "skips the deleted local day when splitting $start to $end by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  // Exact units step from the previous boundary. 3 × 3033333333333333 exceeds 2^53 and rounds to
  // 9100000000000000, so an anchored third boundary would be 07:46:40 instead of 07:46:39.999999999.
  // Verified against Temporal.ZonedDateTime.add stepping incrementally.
  it.each`
    start                               | end                                 | unit            | amount              | expected
    ${"1970-01-01T00:00:00+00:00[UTC]"} | ${"1970-04-26T17:46:40+00:00[UTC]"} | ${"nanosecond"} | ${3033333333333333} | ${[{ start: "1970-01-01T00:00:00+00:00[UTC]", end: "1970-02-05T02:35:33.333333333+00:00[UTC]" }, { start: "1970-02-05T02:35:33.333333333+00:00[UTC]", end: "1970-03-12T05:11:06.666666666+00:00[UTC]" }, { start: "1970-03-12T05:11:06.666666666+00:00[UTC]", end: "1970-04-16T07:46:39.999999999+00:00[UTC]" }, { start: "1970-04-16T07:46:39.999999999+00:00[UTC]", end: "1970-04-26T17:46:40+00:00[UTC]" }]}
  `(
    "steps $amount $unit boundaries of $start to $end without losing precision past 2^53",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  // Loop bound: steps that never advance past the previous boundary return [] instead of spinning.
  it.each`
    unit
    ${"day"}
    ${"hour"}
  `("returns [] when $unit steps stop advancing", ({ unit }) => {
    vi.spyOn(Temporal.ZonedDateTime.prototype, "add").mockImplementation(
      function (this: Temporal.ZonedDateTime) {
        return this;
      },
    );

    expect(
      splitIntervalByUnitZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-10T00:00:00+00:00[UTC]",
        unit,
        1,
      ),
    ).toEqual([]);
  });

  // No-progress guard: a step that does not move past the previous boundary returns [] rather
  // than looping forever.
  it("returns [] when a step lands before the previous boundary", () => {
    vi.spyOn(Temporal.ZonedDateTime.prototype, "add").mockImplementation(
      function (this: Temporal.ZonedDateTime) {
        return this.subtract({ hours: 1 });
      },
    );

    expect(
      splitIntervalByUnitZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-01T10:00:00+00:00[UTC]",
        "hour",
        1,
      ),
    ).toEqual([]);
  });

  const expectedExactDivision = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-01T06:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-01T06:00:00+00:00[UTC]",
      end: "2024-01-01T12:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-01T12:00:00+00:00[UTC]",
      end: "2024-01-01T18:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-01T18:00:00+00:00[UTC]",
      end: "2024-01-02T00:00:00+00:00[UTC]",
    },
  ];

  const expectedRemainder = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-01T01:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-01T01:00:00+00:00[UTC]",
      end: "2024-01-01T01:30:00+00:00[UTC]",
    },
  ];

  const expectedDayUnit = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-03T00:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-03T00:00:00+00:00[UTC]",
      end: "2024-01-05T00:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-05T00:00:00+00:00[UTC]",
      end: "2024-01-07T00:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-07T00:00:00+00:00[UTC]",
      end: "2024-01-09T00:00:00+00:00[UTC]",
    },
    {
      start: "2024-01-09T00:00:00+00:00[UTC]",
      end: "2024-01-10T00:00:00+00:00[UTC]",
    },
  ];

  const expectedZeroLength = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-01T00:00:00+00:00[UTC]",
    },
  ];

  const expectedSingleStep = [
    {
      start: "2024-01-01T00:00:00+00:00[UTC]",
      end: "2024-01-01T02:00:00+00:00[UTC]",
    },
  ];

  it.each`
    start                               | end                                 | unit      | amount | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"hour"} | ${6}   | ${expectedExactDivision}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"} | ${1}   | ${expectedRemainder}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-10T00:00:00+00:00[UTC]"} | ${"day"}  | ${2}   | ${expectedDayUnit}
  `(
    "returns $expected for $start to $end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                               | end                                 | unit      | amount | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"hour"} | ${1}   | ${expectedZeroLength}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T02:00:00+00:00[UTC]"} | ${"hour"} | ${2}   | ${expectedSingleStep}
  `(
    "returns $expected for edge-case $start to $end split by $amount $unit",
    ({ start, end, unit, amount, expected }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, amount)).toEqual(
        expected,
      );
    },
  );

  it.each`
    start                               | end                                 | unit         | amount
    ${"invalid"}                        | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${""}                               | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"invalid"}                        | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${""}                               | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"hour"}    | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"invalid"} | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${""}        | ${1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${0}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${-1}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"2024-01-01T01:30:00+00:00[UTC]"} | ${"hour"}    | ${1.5}
  `(
    "returns [] for invalid $start, $end, $unit, or $amount",
    ({ start, end, unit, amount }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, amount)).toEqual([]);
    },
  );

  it.each`
    start           | end             | unit            | amount
    ${null}         | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${null}         | ${"2024-01-01"} | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${null}         | ${"2024-01-01"}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${null}
  `(
    "returns [] for non-string or non-number input: $start, $end, $unit, $amount",
    ({ start, end, unit, amount }) => {
      expect(
        splitIntervalByUnitZoned(
          start as never,
          end as never,
          unit as never,
          amount as never,
        ),
      ).toEqual([]);
    },
  );

  it("returns [] when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      splitIntervalByUnitZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-02T00:00:00+00:00[UTC]",
        "hour",
        6,
      ),
    ).toEqual([]);
  });

  it("proves zone-invariance across battleTestTimeZones for exact division", () => {
    const startInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-01-02T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();

      const result = splitIntervalByUnitZoned(start, end, "hour", 6);

      expect(result).toHaveLength(4);
      expect(result[0].start).toBe(start);
      expect(result[3].end).toBe(end);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for remainder case", () => {
    const startInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-01-01T01:30:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();

      const result = splitIntervalByUnitZoned(start, end, "hour", 1);

      expect(result).toHaveLength(2);
      expect(result[0].start).toBe(start);
      expect(result[1].end).toBe(end);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for day unit", () => {
    const startInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-01-10T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();

      const result = splitIntervalByUnitZoned(start, end, "day", 2);

      expect(result).toHaveLength(5);
      expect(result[0].start).toBe(start);
      expect(result[4].end).toBe(end);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for zero-length interval", () => {
    const instant = Temporal.Instant.from("2024-01-01T00:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const zdt = instant.toZonedDateTimeISO(timeZone);
      const start = zdt.toString();
      const end = zdt.toString();

      const result = splitIntervalByUnitZoned(start, end, "hour", 1);

      expect(result).toHaveLength(1);
      expect(result[0].start).toBe(start);
      expect(result[0].end).toBe(end);
    }
  });

  it("proves zone-invariance across battleTestTimeZones for single step", () => {
    const startInstant = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-01-01T02:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      const start = startInstant.toZonedDateTimeISO(timeZone).toString();
      const end = endInstant.toZonedDateTimeISO(timeZone).toString();

      const result = splitIntervalByUnitZoned(start, end, "hour", 2);

      expect(result).toHaveLength(1);
      expect(result[0].start).toBe(start);
      expect(result[0].end).toBe(end);
    }
  });
  // The arguments name different calendars (hebrew and a bare iso8601 string), so the
  // result is the sentinel (TC39 CalendarEquals makes until throw).
  it("returns [] when start and end name different calendars", () => {
    expect(
      splitIntervalByUnitZoned(
        "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]",
        "2024-06-30T23:59:59+00:00[UTC]",
        "month",
        1,
      ),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// E7 (issue #152), D5-zoned. Every expected value produced by running
// @js-temporal/polyfill@0.5.1.
// ---------------------------------------------------------------------------------------------
describe("splitIntervalByUnitZoned with GMT calendar-annotated values", () => {
  const Y = calendarZonedFixtures.hebrewLeapYearSpan;
  const ISLAMIC_END =
    "2024-10-03T00:00:00-04:00[America/New_York][u-ca=islamic-tbla]";

  it("splits a Hebrew leap year into 13 month-slices, tagging every boundary", () => {
    const slices = splitIntervalByUnitZoned(
      Y.tishri1_5784NewYork,
      Y.tishri1_5785NewYork,
      "month",
      1,
    );

    expect(slices).toHaveLength(13);
    for (const slice of slices) {
      expect(slice.start).toContain("[u-ca=hebrew]");
      expect(slice.end).toContain("[u-ca=hebrew]");
      expect(slice.start.indexOf("[America/New_York]")).toBeLessThan(
        slice.start.indexOf("[u-ca="),
      );
    }
    expect(slices[0].start).toBe(Y.tishri1_5784NewYork);
    expect(slices[12].end).toBe(Y.tishri1_5785NewYork);
  });

  it("steps a sub-day unit inside the resolved calendar", () => {
    const dayStart = "2024-01-01T00:00:00-05:00[America/New_York][u-ca=hebrew]";
    const dayEnd = "2024-01-02T00:00:00-05:00[America/New_York][u-ca=hebrew]";

    expect(splitIntervalByUnitZoned(dayStart, dayEnd, "hour", 6)).toEqual([
      {
        start: dayStart,
        end: "2024-01-01T06:00:00-05:00[America/New_York][u-ca=hebrew]",
      },
      {
        start: "2024-01-01T06:00:00-05:00[America/New_York][u-ca=hebrew]",
        end: "2024-01-01T12:00:00-05:00[America/New_York][u-ca=hebrew]",
      },
      {
        start: "2024-01-01T12:00:00-05:00[America/New_York][u-ca=hebrew]",
        end: "2024-01-01T18:00:00-05:00[America/New_York][u-ca=hebrew]",
      },
      {
        start: "2024-01-01T18:00:00-05:00[America/New_York][u-ca=hebrew]",
        end: dayEnd,
      },
    ]);
  });

  // TC39 CalendarEquals — a pair naming different calendars returns [] (native Chromium
  // 153 until: "Mismatched calendars.").
  it("returns [] for a pair naming different calendars", () => {
    expect(
      splitIntervalByUnitZoned(Y.tishri1_5784NewYork, ISLAMIC_END, "month", 1),
    ).toEqual([]);
  });

  it.each`
    value                                                         | reason
    ${"5784-01-01T00:00:00-04:00[America/New_York][u-ca=hebrew]"} | ${"-04:00 is not New York's offset on ISO 5784-01-01"}
    ${"2024-13-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"} | ${"ISO month 13 (the digits are ISO)"}
  `("returns [] when the start is $value ($reason)", ({ value }) => {
    expect(splitIntervalByUnitZoned(value, Y.isoEnd, "day", 1)).toEqual([]);
  });
});

// CORE-6 S5: calendar-unit boundaries are the calendar's own NonISODateAdd from the start (anchored).
// Values: Chromium 153 native Temporal `start.add({ months: k })`, read in the calendar.
describe("splitIntervalByUnitZoned in non-ISO calendars (CORE-6)", () => {
  it("splits +275760-07-10 to +275760-09-07 in hebrew by month near the maximum (D1)", () => {
    expect(
      splitIntervalByUnitZoned(
        "+275760-07-10T00:00:00+00:00[UTC][u-ca=hebrew]",
        "+275760-09-07T00:00:00+00:00[UTC][u-ca=hebrew]",
        "month",
        1,
      ),
    ).toEqual([
      {
        start: "+275760-07-10T00:00:00+00:00[UTC][u-ca=hebrew]",
        end: "+275760-08-09T00:00:00+00:00[UTC][u-ca=hebrew]",
      },
      {
        start: "+275760-08-09T00:00:00+00:00[UTC][u-ca=hebrew]",
        end: "+275760-09-07T00:00:00+00:00[UTC][u-ca=hebrew]",
      },
    ]);
  });

  it("splits 1000-01-31 to 1000-04-30 in buddhist by month with proleptic month ends (D2)", () => {
    expect(
      splitIntervalByUnitZoned(
        "1000-01-31T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]",
        "1000-04-30T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]",
        "month",
        1,
      ),
    ).toEqual([
      {
        start: "1000-01-31T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]",
        end: "1000-02-28T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]",
      },
      {
        start: "1000-02-28T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]",
        end: "1000-03-31T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]",
      },
      {
        start: "1000-03-31T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]",
        end: "1000-04-30T00:00:00-12:00[Etc/GMT+12][u-ca=buddhist]",
      },
    ]);
  });

  // The offset is written by FormatDateTimeUTCOffsetRounded, so local mean time -04:56:02 is
  // written -04:56 (native Chromium 153 agrees).
  it("splits -100000-01-01 to -100000-02-29 in hebrew by month in a year <= 0 (D3)", () => {
    expect(
      splitIntervalByUnitZoned(
        "-100000-01-01T00:00:00-04:56:02[America/New_York][u-ca=hebrew]",
        "-100000-02-29T00:00:00-04:56:02[America/New_York][u-ca=hebrew]",
        "month",
        1,
      ),
    ).toEqual([
      {
        start: "-100000-01-01T00:00:00-04:56[America/New_York][u-ca=hebrew]",
        end: "-100000-01-30T00:00:00-04:56[America/New_York][u-ca=hebrew]",
      },
      {
        start: "-100000-01-30T00:00:00-04:56[America/New_York][u-ca=hebrew]",
        end: "-100000-02-29T00:00:00-04:56[America/New_York][u-ca=hebrew]",
      },
    ]);
  });
});

describe("splitIntervalByUnitZoned maxPieces", () => {
  // Owner decision A2: maxPieces bounds the number of slices. At or above the slice count the
  // output is unchanged; one below it returns the sentinel.
  it.each`
    maxPieces
    ${4}
    ${9}
  `(
    "returns 4 slices for 2024-01-31T10:00:00+00:00[UTC] to 2024-05-15T10:00:00+00:00[UTC] by 1 month with maxPieces $maxPieces",
    ({ maxPieces }) => {
      expect(
        splitIntervalByUnitZoned(
          "2024-01-31T10:00:00+00:00[UTC]",
          "2024-05-15T10:00:00+00:00[UTC]",
          "month",
          1,
          { maxPieces },
        ),
      ).toEqual([
        {
          start: "2024-01-31T10:00:00+00:00[UTC]",
          end: "2024-02-29T10:00:00+00:00[UTC]",
        },
        {
          start: "2024-02-29T10:00:00+00:00[UTC]",
          end: "2024-03-31T10:00:00+00:00[UTC]",
        },
        {
          start: "2024-03-31T10:00:00+00:00[UTC]",
          end: "2024-04-30T10:00:00+00:00[UTC]",
        },
        {
          start: "2024-04-30T10:00:00+00:00[UTC]",
          end: "2024-05-15T10:00:00+00:00[UTC]",
        },
      ]);
    },
  );

  it.each`
    maxPieces
    ${3}
    ${1}
  `(
    "returns [] for 2024-01-31T10:00:00+00:00[UTC] to 2024-05-15T10:00:00+00:00[UTC] by 1 month (4 slices) over maxPieces $maxPieces",
    ({ maxPieces }) => {
      expect(
        splitIntervalByUnitZoned(
          "2024-01-31T10:00:00+00:00[UTC]",
          "2024-05-15T10:00:00+00:00[UTC]",
          "month",
          1,
          { maxPieces },
        ).length,
      ).toBe(0);
    },
  );

  it.each`
    maxPieces
    ${3}
    ${8}
  `(
    "returns 3 slices for 2024-01-01T00:00:00+00:00[UTC] to 2024-01-01T03:00:00+00:00[UTC] by 1 hour with maxPieces $maxPieces",
    ({ maxPieces }) => {
      expect(
        splitIntervalByUnitZoned(
          "2024-01-01T00:00:00+00:00[UTC]",
          "2024-01-01T03:00:00+00:00[UTC]",
          "hour",
          1,
          { maxPieces },
        ),
      ).toEqual([
        {
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-01-01T01:00:00+00:00[UTC]",
        },
        {
          start: "2024-01-01T01:00:00+00:00[UTC]",
          end: "2024-01-01T02:00:00+00:00[UTC]",
        },
        {
          start: "2024-01-01T02:00:00+00:00[UTC]",
          end: "2024-01-01T03:00:00+00:00[UTC]",
        },
      ]);
    },
  );

  it.each`
    maxPieces
    ${2}
    ${1}
  `(
    "returns [] for 2024-01-01T00:00:00+00:00[UTC] to 2024-01-01T03:00:00+00:00[UTC] by 1 hour (3 slices) over maxPieces $maxPieces",
    ({ maxPieces }) => {
      expect(
        splitIntervalByUnitZoned(
          "2024-01-01T00:00:00+00:00[UTC]",
          "2024-01-01T03:00:00+00:00[UTC]",
          "hour",
          1,
          { maxPieces },
        ).length,
      ).toBe(0);
    },
  );

  // 20 day slices in UTC. The zoned lower bound allows for offset changes and stalled steps, so
  // this limit is enforced while stepping rather than up front.
  it.each`
    maxPieces | expected
    ${20}     | ${20}
    ${19}     | ${0}
  `(
    "returns $expected slices for 20 days by 1 day with maxPieces $maxPieces",
    ({ maxPieces, expected }) => {
      const result = splitIntervalByUnitZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-21T00:00:00+00:00[UTC]",
        "day",
        1,
        { maxPieces },
      );
      expect(result.length).toBe(expected);
      if (expected > 0) {
        expect(result[0]).toEqual({
          start: "2024-01-01T00:00:00+00:00[UTC]",
          end: "2024-01-02T00:00:00+00:00[UTC]",
        });
        expect(result[19]).toEqual({
          start: "2024-01-20T00:00:00+00:00[UTC]",
          end: "2024-01-21T00:00:00+00:00[UTC]",
        });
      }
    },
  );

  it("returns one slice for a zero-length interval with maxPieces 1", () => {
    expect(
      splitIntervalByUnitZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-01T00:00:00+00:00[UTC]",
        "hour",
        1,
        { maxPieces: 1 },
      ),
    ).toEqual([
      {
        start: "2024-01-01T00:00:00+00:00[UTC]",
        end: "2024-01-01T00:00:00+00:00[UTC]",
      },
    ]);
  });

  it.each`
    label                   | options
    ${"maxPieces 0"}        | ${{ maxPieces: 0 }}
    ${"maxPieces -1"}       | ${{ maxPieces: -1 }}
    ${"maxPieces 1.5"}      | ${{ maxPieces: 1.5 }}
    ${"maxPieces NaN"}      | ${{ maxPieces: Number.NaN }}
    ${"maxPieces Infinity"} | ${{ maxPieces: Number.POSITIVE_INFINITY }}
    ${"maxPieces string"}   | ${{ maxPieces: "5" }}
    ${"null options"}       | ${null}
    ${"number options"}     | ${5}
  `("returns [] for invalid $label", ({ options }) => {
    expect(
      splitIntervalByUnitZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-01T03:00:00+00:00[UTC]",
        "hour",
        1,
        options as never,
      ).length,
    ).toBe(0);
  });
});

describe("splitIntervalByUnitZoned default piece limit", () => {
  // Default maxPieces is 1_000_000: a larger split returns the sentinel instead of exhausting the
  // heap.
  it.each`
    start                                  | end                                     | unit             | slices
    ${"2024-01-01T00:00:00+00:00[UTC]"}    | ${"2024-01-01T00:00:01+00:00[UTC]"}     | ${"nanosecond"}  | ${"1_000_000_000 nanoseconds"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}    | ${"2024-01-01T00:16:40.001+00:00[UTC]"} | ${"millisecond"} | ${"1_000_001 milliseconds"}
    ${"-271821-04-20T00:00:00+00:00[UTC]"} | ${"+275760-09-13T00:00:00+00:00[UTC]"}  | ${"day"}         | ${"200_000_000 days"}
  `(
    "returns [] for $start to $end by 1 $unit ($slices)",
    ({ start, end, unit }) => {
      expect(splitIntervalByUnitZoned(start, end, unit, 1).length).toBe(0);
    },
  );

  // A step past Temporal's maximum (instant +275760-09-13T00:00:00Z; PlainDateTime
  // +275760-09-13T23:59:59.999999999; PlainDate +275760-09-13) lands after the representable `end`,
  // so the last piece is trimmed to `end` rather than discarding the split.
  it.each`
    start                                               | unit      | amount
    ${"+275760-09-12T23:00:00+00:00[UTC]"}              | ${"hour"} | ${2}
    ${"+275760-09-12T12:00:00+00:00[UTC]"}              | ${"day"}  | ${1}
    ${"+275760-09-12T08:00:00-04:00[America/New_York]"} | ${"day"}  | ${1}
  `(
    "returns one piece from $start to the maximum instant by $amount $unit",
    ({ start, unit, amount }) => {
      const end = start.endsWith("[UTC]")
        ? "+275760-09-13T00:00:00+00:00[UTC]"
        : "+275760-09-12T20:00:00-04:00[America/New_York]";
      expect(splitIntervalByUnitZoned(start, end, unit, amount)).toEqual([
        { start, end },
      ]);
    },
  );
});

// An unknown unit is invalid input whatever the span: a non-empty interval already returns
// [] for it, so a zero-length interval must too, rather than the one zero-length slice a valid
// unit gives.
describe("splitIntervalByUnitZoned rejects an invalid unit on a zero-length interval", () => {
  it.each`
    unit
    ${"invalid"}
    ${"fortnight"}
  `("returns [] for unit $unit", ({ unit }) => {
    expect(
      splitIntervalByUnitZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "2024-01-01T00:00:00+00:00[UTC]",
        unit,
        1,
      ),
    ).toEqual([]);
  });
});
