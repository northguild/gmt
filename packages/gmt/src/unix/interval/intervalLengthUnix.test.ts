import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { intervalLengthUnix } from "./intervalLengthUnix";

// Epoch values used below, in ISO 8601 UTC:
// 0             is 1970-01-01T00:00:00Z
// 1704067200000 is 2024-01-01T00:00:00Z
// 1704153540000 is 2024-01-01T23:59:00Z
// 1704153660000 is 2024-01-02T00:01:00Z
// 1709596800000 is 2024-03-05T00:00:00Z
// 1735689600000 is 2025-01-01T00:00:00Z
// 1710046800000 is 2024-03-10T00:00:00-05:00[America/New_York]
// 1710129600000 is 2024-03-11T00:00:00-04:00[America/New_York]

describe("intervalLengthUnix", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
  });

  it.each`
    start            | end              | unit        | expected
    ${0}             | ${86400000}      | ${"hour"}   | ${24}
    ${0}             | ${5400000}       | ${"hour"}   | ${1.5}
    ${1704153540000} | ${1704153660000} | ${"day"}    | ${2 / 1440}
    ${1704153540000} | ${1704153660000} | ${"minute"} | ${2}
    ${1704067200000} | ${1709596800000} | ${"month"}  | ${2.129032258064516}
    ${1704067200000} | ${1735689600000} | ${"year"}   | ${1}
  `(
    "returns $expected $unit for $start to $end in the system timeZone",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthUnix(start, end, unit)).toBeCloseTo(expected, 9);
    },
  );

  it.each`
    start              | end                | unit      | expected
    ${"0"}             | ${"86400000"}      | ${"hour"} | ${24}
    ${"1704067200000"} | ${"1709596800000"} | ${"day"}  | ${64}
  `(
    "returns $expected for numeric-string input $start to $end in $unit",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthUnix(start, end, unit)).toBeCloseTo(expected, 9);
    },
  );

  it.each`
    start       | end         | unit
    ${0}        | ${0}        | ${"hour"}
    ${86400000} | ${86400000} | ${"day"}
  `(
    "returns 0 for zero-length $start to $end in $unit",
    ({ start, end, unit }) => {
      expect(intervalLengthUnix(start, end, unit)).toBe(0);
    },
  );

  it("returns exactly 23 real hours across a spring-forward day in America/New_York", () => {
    expect(
      intervalLengthUnix(1710046800000, 1710129600000, "hour", {
        timeZone: "America/New_York",
      }),
    ).toBe(23);
  });

  it("returns exactly 1 calendar day for a spring-forward day even though it is 23 real hours", () => {
    expect(
      intervalLengthUnix(1710046800000, 1710129600000, "day", {
        timeZone: "America/New_York",
      }),
    ).toBe(1);
  });

  it("proves zone-invariance across battleTestTimeZones for a fixed real-time span measured in hours", () => {
    const startInstant = Temporal.Instant.from("2024-06-01T00:00:00Z");
    const endInstant = Temporal.Instant.from("2024-06-01T05:00:00Z");

    for (const timeZone of battleTestTimeZones) {
      expect(
        intervalLengthUnix(
          startInstant.epochMilliseconds,
          endInstant.epochMilliseconds,
          "hour",
          { timeZone },
        ),
        `hour length in ${timeZone}`,
      ).toBe(5);
    }
  });

  it.each`
    start             | end         | unit
    ${NaN}            | ${86400000} | ${"hour"}
    ${Infinity}       | ${86400000} | ${"hour"}
    ${-Infinity}      | ${86400000} | ${"hour"}
    ${1.5}            | ${86400000} | ${"hour"}
    ${0}              | ${NaN}      | ${"hour"}
    ${0}              | ${Infinity} | ${"hour"}
    ${0}              | ${1.5}      | ${"hour"}
    ${"not-a-number"} | ${86400000} | ${"hour"}
    ${86400000}       | ${0}        | ${"hour"}
    ${0}              | ${86400000} | ${"invalid"}
    ${0}              | ${86400000} | ${""}
    ${0}              | ${86400000} | ${"quarter"}
    ${""}             | ${86400000} | ${"hour"}
    ${0}              | ${""}       | ${"hour"}
    ${"0"}            | ${"1.5"}    | ${"hour"}
    ${0}              | ${2 ** 53}  | ${"hour"}
    ${"   "}          | ${86400000} | ${"hour"}
    ${-(2 ** 53)}     | ${0}        | ${"hour"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalLengthUnix(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start        | end          | unit
    ${null}      | ${86400000}  | ${"hour"}
    ${undefined} | ${86400000}  | ${"hour"}
    ${true}      | ${86400000}  | ${"hour"}
    ${[]}        | ${86400000}  | ${"hour"}
    ${{}}        | ${86400000}  | ${"hour"}
    ${0}         | ${null}      | ${"hour"}
    ${0}         | ${undefined} | ${"hour"}
    ${0}         | ${true}      | ${"hour"}
    ${0}         | ${[]}        | ${"hour"}
    ${0}         | ${{}}        | ${"hour"}
    ${0}         | ${86400000}  | ${null}
    ${0}         | ${86400000}  | ${undefined}
    ${0}         | ${86400000}  | ${123}
    ${0}         | ${86400000}  | ${true}
    ${0}         | ${86400000}  | ${[]}
    ${0}         | ${86400000}  | ${{}}
  `(
    "returns null for non-number or non-string input: $start, $end, $unit",
    ({ start, end, unit }) => {
      expect(
        intervalLengthUnix(start as never, end as never, unit as never),
      ).toBeNull();
    },
  );

  it("returns null for timeZone local when the system timeZone is unavailable", () => {
    timeZoneSpy.mockReturnValue("");

    expect(
      intervalLengthUnix(0, 86400000, "hour", { timeZone: "local" }),
    ).toBeNull();
  });
});

// The last representable instant, +275760-09-13T00:00:00Z, in epoch milliseconds (TC39 nsMaxInstant).
const MAX_MS = 8_640_000_000_000_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

describe("intervalLengthUnix at the maximum instant", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    timeZoneSpy = vi.spyOn(getSystemTimeZoneModule, "getSystemTimeZone");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
  });

  // TC39 DifferenceZonedDateTime + NudgeToCalendarUnit: max - 3d5h to max - 1d is P2DT5H, totalled
  // over the day that ends at max as 2 + 5/24; the zone ahead of UTC puts that day's end wall
  // clock past +275760-09-13T00:00, but its exact time is in range.
  it.each`
    start                                | end                    | timeZone                | expected
    ${MAX_MS - 3 * DAY_MS - 5 * HOUR_MS} | ${MAX_MS - DAY_MS}     | ${"Australia/Sydney"}   | ${2.2083333333333335}
    ${MAX_MS - 3 * DAY_MS - 5 * HOUR_MS} | ${MAX_MS - DAY_MS}     | ${"Pacific/Kiritimati"} | ${2.2083333333333335}
    ${MAX_MS - 7 * DAY_MS - HOUR_MS}     | ${MAX_MS - 5 * DAY_MS} | ${"UTC"}                | ${2.0416666666666665}
  `(
    "returns $expected days for $start to $end in timeZone $timeZone",
    ({ start, end, timeZone, expected }) => {
      expect(intervalLengthUnix(start, end, "day", { timeZone })).toBe(
        expected,
      );
    },
  );

  // TC39 NudgeToCalendarUnit: the day window after the end starts past the maximum, so Temporal
  // throws — in UTC too, whose exact times GetPossibleEpochNanoseconds validates.
  it.each`
    start                            | end       | timeZone
    ${MAX_MS - 2 * DAY_MS}           | ${MAX_MS} | ${"Australia/Sydney"}
    ${MAX_MS - 2 * DAY_MS - HOUR_MS} | ${MAX_MS} | ${"UTC"}
    ${MAX_MS - 2 * DAY_MS - HOUR_MS} | ${MAX_MS} | ${"Europe/London"}
  `(
    "returns null in days for $start to $end in timeZone $timeZone",
    ({ start, end, timeZone }) => {
      expect(intervalLengthUnix(start, end, "day", { timeZone })).toBeNull();
    },
  );
});

// The first representable instant, -271821-04-20T00:00:00Z, in epoch milliseconds (TC39 nsMinInstant).
const MIN_MS = -MAX_MS;

describe("intervalLengthUnix at the minimum instant", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    timeZoneSpy = vi.spyOn(getSystemTimeZoneModule, "getSystemTimeZone");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
  });

  // In a zone behind UTC the minimum's wall clock is on -271821-04-19 (New York LMT -04:56:02 gives
  // 19:03:58; Honolulu LMT -10:31:26 gives 13:28:34). TC39 DifferenceZonedDateTime: min to
  // min + 2d1h is P2DT1H; NudgeToCalendarUnit totals it over the day from min + 2d to min + 3d,
  // whose wall clocks resolve in range: 2 + 1/24 days.
  it.each`
    start     | end                              | timeZone
    ${MIN_MS} | ${MIN_MS + 2 * DAY_MS + HOUR_MS} | ${"America/New_York"}
    ${MIN_MS} | ${MIN_MS + 2 * DAY_MS + HOUR_MS} | ${"Pacific/Honolulu"}
  `(
    "returns 2.0416666666666665 days for $start to $end in timeZone $timeZone",
    ({ start, end, timeZone }) => {
      expect(intervalLengthUnix(start, end, "day", { timeZone })).toBe(
        2.0416666666666665,
      );
    },
  );
});

describe("intervalLengthUnix epochUnit and timeZone options", () => {
  // 1710046800000–1710129600000 is New York's 2024-03-10, a 23-hour local day (spring forward):
  // one calendar day there, 23/24 of a UTC day.
  it.each`
    start            | end              | unit       | options                                                   | expected
    ${1710046800000} | ${1710129600000} | ${"day"}   | ${{ timeZone: "America/New_York" }}                       | ${1}
    ${1710046800000} | ${1710129600000} | ${"day"}   | ${undefined}                                              | ${23 / 24}
    ${1710046800000} | ${1710129600000} | ${"day"}   | ${{ timeZone: "UTC" }}                                    | ${23 / 24}
    ${0}             | ${86400}         | ${"hour"}  | ${{ epochUnit: "seconds" }}                               | ${24}
    ${"0"}           | ${"86400"}       | ${"hours"} | ${{ epochUnit: "second" }}                                | ${24}
    ${1710046800}    | ${1710129600}    | ${"day"}   | ${{ epochUnit: "seconds", timeZone: "America/New_York" }} | ${1}
    ${0}             | ${86400000}      | ${"hour"}  | ${{ timeZone: "America/New_Yrok" }}                       | ${null}
    ${0}             | ${86400000}      | ${"hour"}  | ${{ epochUnit: "nanoseconds" }}                           | ${null}
  `(
    "returns $expected for [$start, $end) in $unit with options $options",
    ({ start, end, unit, options, expected }) => {
      const result = intervalLengthUnix(start, end, unit, options);
      if (typeof expected === "number") {
        expect(result).toBeCloseTo(expected, 12);
      } else {
        expect(result).toBe(expected);
      }
    },
  );
});
