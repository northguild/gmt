import { Temporal } from "@js-temporal/polyfill";
import {
  durationCompare,
  durationRound,
  durationTotal,
  zonedUntil,
} from "./zonedWallClockDifference";

// Epoch nanoseconds of the last and first representable instants (TC39 nsMaxInstant / nsMinInstant).
const MAX_INSTANT = 8_640_000_000_000_000_000_000n;
const MIN_INSTANT = -MAX_INSTANT;
const HOUR = 3_600_000_000_000n;
const DAY = 24n * HOUR;

const SYDNEY = "Australia/Sydney";
const KIRITIMATI = "Pacific/Kiritimati";
const NEW_YORK = "America/New_York";
const HONOLULU = "Pacific/Honolulu";

/** Built from an exact time, so no wall clock is resolved: an independent oracle at the limits. */
const at = (epochNanoseconds: bigint, timeZone: string) =>
  new Temporal.ZonedDateTime(epochNanoseconds, timeZone);

/*
 * Every expected value below is TC39 Temporal's answer, read from Chromium 152's built-in Temporal
 * (the same calls, with the exact times written here) and walked through the spec's
 * DifferenceZonedDateTime / NudgeToCalendarUnit / NudgeToZonedTime / BubbleRelativeDuration steps.
 * `@js-temporal/polyfill` 0.5.1 throws for the rows marked "polyfill throws": wall clocks past the
 * maximum in zones ahead of UTC, and the minimum instant's local dates in zones behind UTC.
 */

describe("zonedUntil at the range limits", () => {
  it.each`
    timeZone      | from                                   | to                                    | options                                                                                     | expected     | note
    ${SYDNEY}     | ${MAX_INSTANT - 400n * DAY}            | ${MAX_INSTANT}                        | ${{ largestUnit: "year" }}                                                                  | ${"P1Y1M3D"} | ${"polyfill throws; a DST change lies in the window"}
    ${SYDNEY}     | ${MAX_INSTANT - 3n * DAY - 5n * HOUR}  | ${MAX_INSTANT - DAY - 5n * HOUR}      | ${{ largestUnit: "day", smallestUnit: "hour" }}                                             | ${"P2D"}     | ${"polyfill throws; NudgeToZonedTime's day end is in range"}
    ${SYDNEY}     | ${MAX_INSTANT - 3n * DAY - 5n * HOUR}  | ${MAX_INSTANT - DAY - 5n * HOUR}      | ${{ largestUnit: "day", smallestUnit: "hour", roundingIncrement: 6, roundingMode: "ceil" }} | ${"P2D"}     | ${"polyfill throws"}
    ${SYDNEY}     | ${MAX_INSTANT - 40n * DAY - 7n * HOUR} | ${MAX_INSTANT - 2n * DAY}             | ${{ largestUnit: "month", smallestUnit: "day", roundingMode: "halfExpand" }}                | ${"P1M7D"}   | ${"polyfill agrees"}
    ${SYDNEY}     | ${MAX_INSTANT - 60n * DAY}             | ${MAX_INSTANT - DAY}                  | ${{ largestUnit: "week" }}                                                                  | ${"P8W3D"}   | ${"polyfill agrees"}
    ${KIRITIMATI} | ${MAX_INSTANT}                         | ${MAX_INSTANT - 3n * DAY - 5n * HOUR} | ${{ largestUnit: "day" }}                                                                   | ${"-P3DT5H"} | ${"polyfill agrees"}
    ${KIRITIMATI} | ${MAX_INSTANT - DAY}                   | ${MAX_INSTANT - 100n * DAY}           | ${{ largestUnit: "month", smallestUnit: "day", roundingMode: "halfEven" }}                  | ${"-P3M7D"}  | ${"polyfill agrees"}
    ${NEW_YORK}   | ${MIN_INSTANT + DAY}                   | ${MIN_INSTANT}                        | ${{ largestUnit: "day" }}                                                                   | ${"-P1D"}    | ${"polyfill throws at the minimum's local date"}
    ${NEW_YORK}   | ${MIN_INSTANT + 40n * DAY}             | ${MIN_INSTANT}                        | ${{ largestUnit: "month" }}                                                                 | ${"-P1M10D"} | ${"polyfill throws"}
    ${NEW_YORK}   | ${MIN_INSTANT}                         | ${MIN_INSTANT + 3n * DAY + 5n * HOUR} | ${{ largestUnit: "day", smallestUnit: "hour" }}                                             | ${"P3DT5H"}  | ${"polyfill agrees"}
    ${HONOLULU}   | ${MIN_INSTANT + 2n * DAY}              | ${MIN_INSTANT}                        | ${{ largestUnit: "month" }}                                                                 | ${"-P2D"}    | ${"polyfill throws"}
  `(
    "returns $expected from $from to $to in $timeZone with $options ($note)",
    ({ timeZone, from, to, options, expected }) => {
      expect(
        zonedUntil(at(from, timeZone), at(to, timeZone), options).toString(),
      ).toBe(expected);
    },
  );

  it.each`
    timeZone      | from                                   | to                         | options                                                                     | reason
    ${SYDNEY}     | ${MAX_INSTANT - 40n * DAY - 7n * HOUR} | ${MAX_INSTANT - 2n * DAY}  | ${{ largestUnit: "year", smallestUnit: "week", roundingMode: "expand" }}    | ${"the expanded week ends past the maximum"}
    ${SYDNEY}     | ${MAX_INSTANT - 60n * DAY}             | ${MAX_INSTANT}             | ${{ largestUnit: "month", smallestUnit: "month", roundingMode: "floor" }}   | ${"the month window ends past the maximum"}
    ${SYDNEY}     | ${MAX_INSTANT - 12n * HOUR}            | ${MAX_INSTANT - HOUR}      | ${{ largestUnit: "day", smallestUnit: "minute", roundingIncrement: 30 }}    | ${"the next local day starts past the maximum"}
    ${SYDNEY}     | ${MAX_INSTANT - 26n * HOUR}            | ${MAX_INSTANT - 2n * HOUR} | ${{ largestUnit: "day", smallestUnit: "hour", roundingMode: "halfExpand" }} | ${"the next local day starts past the maximum"}
    ${KIRITIMATI} | ${MAX_INSTANT - 2n * DAY - 3n * HOUR}  | ${MAX_INSTANT - HOUR}      | ${{ largestUnit: "day", smallestUnit: "day", roundingMode: "trunc" }}       | ${"the day window ends past the maximum"}
    ${NEW_YORK}   | ${MIN_INSTANT + 10n * DAY}             | ${MIN_INSTANT + HOUR}      | ${{ largestUnit: "week", smallestUnit: "day", roundingMode: "halfExpand" }} | ${"the day window starts before the minimum"}
    ${SYDNEY}     | ${MAX_INSTANT - DAY}                   | ${MAX_INSTANT}             | ${{ largestUnit: "hour", smallestUnit: "day" }}                             | ${"smallestUnit is larger than largestUnit"}
  `(
    "throws from $from to $to in $timeZone with $options ($reason)",
    ({ timeZone, from, to, options }) => {
      expect(() =>
        zonedUntil(at(from, timeZone), at(to, timeZone), options),
      ).toThrow(RangeError);
    },
  );

  it("throws for different calendars at the maximum", () => {
    expect(() =>
      zonedUntil(
        at(MAX_INSTANT - DAY, SYDNEY),
        at(MAX_INSTANT, SYDNEY).withCalendar("gregory"),
        { largestUnit: "day" },
      ),
    ).toThrow(RangeError);
  });

  // GetPossibleEpochNanoseconds validates every exact time, UTC included; the polyfill's UTC fast
  // path does not, so this rounding window's day end (19 hours past the maximum) must still throw.
  it.each`
    timeZone
    ${"UTC"}
    ${"+00:00"}
    ${"Europe/London"}
  `(
    "throws rounding to an hour from max - 3d5h to max in $timeZone",
    ({ timeZone }) => {
      expect(() =>
        zonedUntil(
          at(MAX_INSTANT - 3n * DAY - 5n * HOUR, timeZone),
          at(MAX_INSTANT, timeZone),
          { largestUnit: "day", smallestUnit: "hour" },
        ),
      ).toThrow(RangeError);
    },
  );

  it.each`
    timeZone
    ${"UTC"}
    ${"+00:00"}
    ${"Europe/London"}
  `(
    "returns P5DT5H rounding to an hour from max - 10d5h to max - 5d in $timeZone",
    ({ timeZone }) => {
      expect(
        zonedUntil(
          at(MAX_INSTANT - 10n * DAY - 5n * HOUR, timeZone),
          at(MAX_INSTANT - 5n * DAY, timeZone),
          { largestUnit: "day", smallestUnit: "hour" },
        ).toString(),
      ).toBe("P5DT5H");
    },
  );

  it("returns the polyfill's own result far from the limits", () => {
    const from = Temporal.ZonedDateTime.from(
      "2024-03-09T02:30:00-05:00[America/New_York]",
    );
    const to = Temporal.ZonedDateTime.from(
      "2024-04-10T01:00:00-04:00[America/New_York]",
    );
    const options = { largestUnit: "month", smallestUnit: "hour" } as const;
    expect(zonedUntil(from, to, options).toString()).toBe(
      from.until(to, options).toString(),
    );
  });
});

describe("durationTotal at the range limits", () => {
  it.each`
    timeZone    | duration    | relativeTo                            | unit       | expected               | note
    ${SYDNEY}   | ${"PT49H"}  | ${MAX_INSTANT - 3n * DAY - 5n * HOUR} | ${"day"}   | ${2.0416666666666665}  | ${"polyfill throws"}
    ${SYDNEY}   | ${"P1D"}    | ${MAX_INSTANT - DAY}                  | ${"hour"}  | ${24}                  | ${"polyfill throws"}
    ${SYDNEY}   | ${"-P1M"}   | ${MAX_INSTANT - DAY}                  | ${"month"} | ${-1}                  | ${"polyfill agrees"}
    ${NEW_YORK} | ${"-PT49H"} | ${MIN_INSTANT + 3n * DAY}             | ${"day"}   | ${-2.0416666666666665} | ${"polyfill throws"}
    ${NEW_YORK} | ${"-P1D"}   | ${MIN_INSTANT + DAY}                  | ${"hour"}  | ${-24}                 | ${"polyfill throws"}
  `(
    "totals $duration in $unit relative to $relativeTo in $timeZone as $expected ($note)",
    ({ timeZone, duration, relativeTo, unit, expected }) => {
      expect(
        durationTotal(
          Temporal.Duration.from(duration),
          unit,
          at(relativeTo, timeZone),
        ),
      ).toBe(expected);
    },
  );

  it.each`
    timeZone      | duration   | relativeTo                            | unit           | reason
    ${SYDNEY}     | ${"P1M9D"} | ${MAX_INSTANT - 40n * DAY}            | ${"month"}     | ${"the month window ends past the maximum"}
    ${SYDNEY}     | ${"P39D"}  | ${MAX_INSTANT - 40n * DAY}            | ${"week"}      | ${"the week window ends past the maximum"}
    ${SYDNEY}     | ${"P2D"}   | ${MAX_INSTANT - 3n * DAY - 5n * HOUR} | ${"year"}      | ${"the year window ends past the maximum"}
    ${KIRITIMATI} | ${"PT73H"} | ${MAX_INSTANT - 3n * DAY - 5n * HOUR} | ${"days"}      | ${"the day window ends past the maximum"}
    ${NEW_YORK}   | ${"-P1M"}  | ${MIN_INSTANT + 40n * DAY}            | ${"month"}     | ${"the month window starts before the minimum"}
    ${SYDNEY}     | ${"PT49H"} | ${MAX_INSTANT - 3n * DAY - 5n * HOUR} | ${"fortnight"} | ${"the unit is not a Temporal unit"}
  `(
    "throws totalling $duration in $unit relative to $relativeTo in $timeZone ($reason)",
    ({ timeZone, duration, relativeTo, unit }) => {
      expect(() =>
        durationTotal(
          Temporal.Duration.from(duration),
          unit,
          at(relativeTo, timeZone),
        ),
      ).toThrow(RangeError);
    },
  );

  it("resolves a zoned relativeTo string in the last hours of the range", () => {
    expect(
      durationTotal(
        Temporal.Duration.from("PT1H"),
        "hours",
        "+275760-09-13T09:00:00+10:00[Australia/Sydney]",
      ),
    ).toBe(1);
  });

  // TC39 NudgeToCalendarUnit: PT49H from max - 2d1h ends at max; its day window ends 23 hours
  // past the maximum, which GetPossibleEpochNanoseconds rejects in every zone, UTC included.
  it.each`
    timeZone
    ${"UTC"}
    ${"+00:00"}
    ${"Europe/London"}
  `(
    "throws totalling PT49H in days from max - 2d1h in $timeZone",
    ({ timeZone }) => {
      expect(() =>
        durationTotal(
          Temporal.Duration.from("PT49H"),
          "days",
          at(MAX_INSTANT - 2n * DAY - HOUR, timeZone),
        ),
      ).toThrow(RangeError);
    },
  );

  it("returns the polyfill's own result for a plain relativeTo", () => {
    expect(
      durationTotal(Temporal.Duration.from("P1M"), "days", "2024-02-01"),
    ).toBe(29);
  });
});

describe("durationRound at the range limits", () => {
  it.each`
    timeZone      | duration     | relativeTo                             | options                                                                                            | expected     | note
    ${SYDNEY}     | ${"PT73H"}   | ${MAX_INSTANT - 3n * DAY - 5n * HOUR}  | ${{ largestUnit: "day" }}                                                                          | ${"P3DT1H"}  | ${"polyfill throws"}
    ${SYDNEY}     | ${"P39DT5H"} | ${MAX_INSTANT - 40n * DAY - 7n * HOUR} | ${{ largestUnit: "month", smallestUnit: "day", roundingMode: "halfExpand" }}                       | ${"P1M8D"}   | ${"polyfill throws"}
    ${SYDNEY}     | ${"P1D"}     | ${MAX_INSTANT - DAY}                   | ${{ largestUnit: "hour" }}                                                                         | ${"PT24H"}   | ${"polyfill throws"}
    ${KIRITIMATI} | ${"PT30H"}   | ${MAX_INSTANT - 2n * DAY}              | ${{ largestUnit: "week", smallestUnit: "hour" }}                                                   | ${"P1DT6H"}  | ${"polyfill throws"}
    ${SYDNEY}     | ${"PT47H"}   | ${MAX_INSTANT - 3n * DAY}              | ${{ largestUnit: "day", smallestUnit: "hour", roundingIncrement: 12, roundingMode: "halfExpand" }} | ${"P2D"}     | ${"polyfill agrees"}
    ${NEW_YORK}   | ${"-PT49H"}  | ${MIN_INSTANT + 3n * DAY}              | ${{ largestUnit: "day" }}                                                                          | ${"-P2DT1H"} | ${"polyfill agrees"}
  `(
    "rounds $duration relative to $relativeTo in $timeZone with $options to $expected ($note)",
    ({ timeZone, duration, relativeTo, options, expected }) => {
      expect(
        durationRound(Temporal.Duration.from(duration), {
          ...options,
          relativeTo: at(relativeTo, timeZone),
        }).toString(),
      ).toBe(expected);
    },
  );

  it.each`
    timeZone    | duration     | relativeTo                            | options                                                                  | reason
    ${SYDNEY}   | ${"PT73H"}   | ${MAX_INSTANT - 3n * DAY - 5n * HOUR} | ${{ largestUnit: "day", smallestUnit: "day" }}                           | ${"the day window ends past the maximum"}
    ${NEW_YORK} | ${"-P1DT1H"} | ${MIN_INSTANT + 3n * DAY}             | ${{ largestUnit: "month", smallestUnit: "day", roundingMode: "expand" }} | ${"the day window starts before the minimum"}
    ${SYDNEY}   | ${"PT73H"}   | ${MAX_INSTANT - 3n * DAY - 5n * HOUR} | ${{ largestUnit: "hour", smallestUnit: "day" }}                          | ${"smallestUnit is larger than largestUnit"}
    ${SYDNEY}   | ${"P3M"}     | ${MAX_INSTANT - 100n * DAY}           | ${{ smallestUnit: "day", roundingIncrement: 2 }}                         | ${"a day increment needs largestUnit day"}
  `(
    "throws rounding $duration relative to $relativeTo in $timeZone with $options ($reason)",
    ({ timeZone, duration, relativeTo, options }) => {
      expect(() =>
        durationRound(Temporal.Duration.from(duration), {
          ...options,
          relativeTo: at(relativeTo, timeZone),
        }),
      ).toThrow(RangeError);
    },
  );
});

describe("durationCompare at the range limits", () => {
  it.each`
    timeZone      | one       | two         | relativeTo                            | expected | note
    ${SYDNEY}     | ${"P3D"}  | ${"PT73H"}  | ${MAX_INSTANT - 3n * DAY - 5n * HOUR} | ${-1}    | ${"polyfill throws"}
    ${SYDNEY}     | ${"P1D"}  | ${"PT24H"}  | ${MAX_INSTANT - DAY}                  | ${0}     | ${"polyfill throws"}
    ${KIRITIMATI} | ${"P1W"}  | ${"PT167H"} | ${MAX_INSTANT - 8n * DAY}             | ${1}     | ${"polyfill agrees"}
    ${NEW_YORK}   | ${"-P1D"} | ${"-PT24H"} | ${MIN_INSTANT + 2n * DAY}             | ${0}     | ${"polyfill agrees"}
  `(
    "compares $one with $two relative to $relativeTo in $timeZone as $expected ($note)",
    ({ timeZone, one, two, relativeTo, expected }) => {
      expect(durationCompare(one, two, at(relativeTo, timeZone))).toBe(
        expected,
      );
    },
  );
});
