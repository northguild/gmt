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
    "returns $expected for $start..$end split by $amount $unit",
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
    "returns $expected for edge-case $start..$end split by $amount $unit",
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
  // E5 (issue #78), decision of record D2 — see isValidZonedDateTime.test.ts for the full
  // rationale: zoned/ rejects any [u-ca=...] calendar annotation outright.
  it("returns [] when start carries a calendar annotation", () => {
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
    "1446-03-30T00:00:00-04:00[u-ca=islamic-tabular][America/New_York]";

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
      expect(slice.start.indexOf("[u-ca=")).toBeLessThan(
        slice.start.indexOf("[America/New_York]"),
      );
    }
    expect(slices[0].start).toBe(Y.tishri1_5784NewYork);
    expect(slices[12].end).toBe(Y.tishri1_5785NewYork);
  });

  it("steps a sub-day unit inside the resolved calendar", () => {
    const dayStart = "5784-04-20T00:00:00-05:00[u-ca=hebrew][America/New_York]";
    const dayEnd = "5784-04-21T00:00:00-05:00[u-ca=hebrew][America/New_York]";

    expect(splitIntervalByUnitZoned(dayStart, dayEnd, "hour", 6)).toEqual([
      {
        start: dayStart,
        end: "5784-04-20T06:00:00-05:00[u-ca=hebrew][America/New_York]",
      },
      {
        start: "5784-04-20T06:00:00-05:00[u-ca=hebrew][America/New_York]",
        end: "5784-04-20T12:00:00-05:00[u-ca=hebrew][America/New_York]",
      },
      {
        start: "5784-04-20T12:00:00-05:00[u-ca=hebrew][America/New_York]",
        end: "5784-04-20T18:00:00-05:00[u-ca=hebrew][America/New_York]",
      },
      {
        start: "5784-04-20T18:00:00-05:00[u-ca=hebrew][America/New_York]",
        end: dayEnd,
      },
    ]);
  });

  // D5 fallback: a mismatched pair steps in Gregorian rather than returning the sentinel, and the
  // boundaries come back as bare ISO because "gregorian" is the resolved calendar.
  it("falls back to Gregorian month-stepping for a mismatched pair", () => {
    const slices = splitIntervalByUnitZoned(
      Y.tishri1_5784NewYork,
      ISLAMIC_END,
      "month",
      1,
    );

    expect(slices).toHaveLength(13);
    for (const slice of slices) {
      expect(slice.start).not.toContain("[u-ca=");
      expect(slice.end).not.toContain("[u-ca=");
    }
  });

  it.each`
    value                                                         | reason
    ${"5784-01-01T00:00:00-04:00[America/New_York][u-ca=hebrew]"} | ${"GMT digits in Temporal's segment ordering"}
    ${"5785-13-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"} | ${"month 13 in a non-leap Hebrew year"}
  `("returns [] when the start is $value ($reason)", ({ value }) => {
    expect(splitIntervalByUnitZoned(value, Y.isoEnd, "day", 1)).toEqual([]);
  });
});
