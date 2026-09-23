import { Temporal } from "@js-temporal/polyfill";
import { mockSystemTimeZone } from "../../test/timeZoneMatrix";
import { diffUnix } from "./diffUnix";

describe("diffUnix", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = mockSystemTimeZone("UTC");
  });

  afterEach(() => {
    cleanup();
  });

  it.each`
    value1        | value2        | unit       | expected
    ${1704067200} | ${1704153600} | ${"days"}  | ${1}
    ${1704067200} | ${1704153600} | ${"hours"} | ${24}
    ${1704067200} | ${1704153600} | ${"weeks"} | ${0}
  `(
    "returns $expected for single unit difference between $value1 and $value2 for unit $unit",
    ({ value1, value2, unit, expected }) => {
      expect(diffUnix(value1, value2, unit, { epochUnit: "seconds" })).toEqual(
        expected,
      );
    },
  );

  it.each`
    value1        | value2        | units                | expected
    ${1704067200} | ${1704153600} | ${["days"]}          | ${{ days: 1 }}
    ${1704067200} | ${1704153600} | ${["hours"]}         | ${{ hours: 24 }}
    ${1704067200} | ${1704326400} | ${["days", "hours"]} | ${{ days: 3, hours: 0 }}
  `(
    "returns $expected for $units difference between $value1 and $value2",
    ({ value1, value2, units, expected }) => {
      expect(diffUnix(value1, value2, units, { epochUnit: "seconds" })).toEqual(
        expected,
      );
    },
  );

  it.each`
    value1        | value2
    ${"invalid"}  | ${1704153600}
    ${1704067200} | ${"invalid"}
    ${null}       | ${1704153600}
    ${1704067200} | ${null}
  `(
    "returns null for invalid inputs: $value1 | $value2",
    ({ value1, value2 }) => {
      expect(diffUnix(value1 as never, value2 as never, "days" as never)).toBe(
        null,
      );
    },
  );

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${2}
    ${"floor"}      | ${1}
    ${"trunc"}      | ${1}
    ${"halfExpand"} | ${2}
  `(
    "rounds a 90-minute span to $expected hours with smallestUnit hour, roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        diffUnix(1709164800000, 1709170200000, "hours", {
          smallestUnit: "hours",
          roundingMode,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    roundingMode | expected
    ${"ceil"}    | ${2}
    ${"floor"}   | ${1}
  `(
    "rounds a 90-minute span to $expected hours across a DST-observing timeZone (America/New_York)",
    ({ roundingMode, expected }) => {
      expect(
        diffUnix(1709164800000, 1709170200000, "hours", {
          smallestUnit: "hours",
          roundingMode,
          timeZone: "America/New_York",
        }),
      ).toBe(expected);
    },
  );

  it("returns the unrounded result when no rounding options are provided", () => {
    expect(
      diffUnix(1704067200, 1704073200, "minutes", { epochUnit: "seconds" }),
    ).toBe(100);
  });

  it("returns null when roundingIncrement does not evenly divide the unit (minutes must divide 60)", () => {
    expect(
      diffUnix(1704067200, 1704073200, "minutes", {
        epochUnit: "seconds",
        smallestUnit: "minutes",
        roundingIncrement: 7,
        roundingMode: "trunc",
      }),
    ).toBeNull();
  });

  it("rounds a negative diff (value1 after value2)", () => {
    expect(
      diffUnix(1709170200000, 1709164800000, "hours", {
        smallestUnit: "hours",
        roundingMode: "halfExpand",
      }),
    ).toBe(-2);
  });

  it("rounds a result using seconds epochUnit", () => {
    expect(
      diffUnix(1709164800, 1709170200, "hours", {
        epochUnit: "seconds",
        smallestUnit: "hours",
        roundingMode: "halfExpand",
      }),
    ).toBe(2);
  });

  it("returns null when smallestUnit is coarser than the largest requested unit", () => {
    expect(
      diffUnix(1709164800000, 1709170200000, ["minutes", "seconds"], {
        smallestUnit: "hours",
      }),
    ).toBeNull();
  });

  it("returns null when Temporal.Instant.fromEpochMilliseconds throws", () => {
    vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(
      () => {
        throw new Error("simulated failure");
      },
    );
    expect(diffUnix(1709164800000, 1709170200000, "hours")).toBeNull();
  });
});

// The last representable instant, +275760-09-13T00:00:00Z, in epoch milliseconds (TC39 nsMaxInstant).
const MAX_MS = 8_640_000_000_000_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

describe("diffUnix at the maximum instant", () => {
  // TC39 DifferenceZonedDateTime: in a zone ahead of UTC the end's wall clock runs past
  // +275760-09-13T00:00, but its exact time is in range, so the whole days are returned.
  it.each`
    value1             | value2    | timeZone                | expected
    ${MAX_MS - DAY_MS} | ${MAX_MS} | ${"Australia/Sydney"}   | ${1}
    ${MAX_MS - DAY_MS} | ${MAX_MS} | ${"Pacific/Kiritimati"} | ${1}
  `(
    "returns $expected days from $value1 to $value2 in $timeZone",
    ({ value1, value2, timeZone, expected }) => {
      expect(diffUnix(value1, value2, "days", { timeZone })).toBe(expected);
    },
  );

  // TC39 NudgeToCalendarUnit: rounding to a day looks at the day after the end, which is
  // past the last representable date, so Temporal throws.
  it.each`
    value1             | value2    | timeZone
    ${MAX_MS - DAY_MS} | ${MAX_MS} | ${"Australia/Sydney"}
    ${MAX_MS - DAY_MS} | ${MAX_MS} | ${"Pacific/Kiritimati"}
  `(
    "returns null rounding days to a day from $value1 to $value2 in $timeZone",
    ({ value1, value2, timeZone }) => {
      expect(
        diffUnix(value1, value2, "days", { timeZone, smallestUnit: "day" }),
      ).toBeNull();
    },
  );

  // TC39 NudgeToZonedTime: rounding P3DT5H to an hour resolves the wall clock one day after
  // +275760-09-12T19:00, i.e. 19 hours past the maximum, and GetPossibleEpochNanoseconds rejects
  // it in every zone — UTC included, which resolves exactly like +00:00.
  it.each`
    timeZone
    ${"UTC"}
    ${"Europe/London"}
  `(
    "returns null rounding to an hour from max - 3d5h to max in $timeZone",
    ({ timeZone }) => {
      expect(
        diffUnix(MAX_MS - 3 * DAY_MS - 5 * HOUR_MS, MAX_MS, "days", {
          timeZone,
          smallestUnit: "hour",
        }),
      ).toBeNull();
    },
  );

  // Five days earlier the same rounding stays in range: P5DT5H is 5 whole days in each zone.
  it.each`
    timeZone
    ${"UTC"}
    ${"Europe/London"}
  `(
    "returns 5 rounding to an hour from max - 10d5h to max - 5d in $timeZone",
    ({ timeZone }) => {
      expect(
        diffUnix(
          MAX_MS - 10 * DAY_MS - 5 * HOUR_MS,
          MAX_MS - 5 * DAY_MS,
          "days",
          {
            timeZone,
            smallestUnit: "hour",
          },
        ),
      ).toBe(5);
    },
  );
});

// The first representable instant, -271821-04-20T00:00:00Z, in epoch milliseconds (TC39 nsMinInstant).
const MIN_MS = -MAX_MS;

describe("diffUnix at the minimum instant", () => {
  // TC39 DifferenceZonedDateTime: in a zone behind UTC the minimum's wall clock falls on
  // -271821-04-19, a date whose exact times are in range, so one day back is exactly -1 day.
  it.each`
    value1             | value2    | timeZone
    ${MIN_MS + DAY_MS} | ${MIN_MS} | ${"America/New_York"}
    ${MIN_MS + DAY_MS} | ${MIN_MS} | ${"Pacific/Honolulu"}
  `(
    "returns -1 days from $value1 to $value2 in $timeZone",
    ({ value1, value2, timeZone }) => {
      expect(diffUnix(value1, value2, "days", { timeZone })).toBe(-1);
    },
  );
});

describe("diffUnix with an unrecognised epochUnit", () => {
  // isValidUnixUnit defines the domain ("seconds" | "milliseconds", singular or plural): any other value is invalid
  // input and returns the sentinel, never a silent read as milliseconds.
  it.each`
    epochUnit
    ${"nanoseconds"}
    ${"SECONDS"}
    ${"ms"}
    ${""}
    ${1000}
  `("returns null for epochUnit $epochUnit", ({ epochUnit }) => {
    expect(
      diffUnix(1_706_659_200, 1_706_659_200, "days", {
        epochUnit: epochUnit as never,
        timeZone: "UTC",
      }),
    ).toBe(null);
  });
});

describe("diffUnix invalid-input @example", () => {
  it('returns null for diffUnix(NaN, 0, "days")', () => {
    expect(diffUnix(NaN, 0, "days")).toBe(null);
  });
});

describe("diffUnix unit names", () => {
  // Temporal §13.17: singular and plural unit names are the same unit. 90000000 ms is P1DT1H in UTC.
  // Record keys are the plural names, as in every other diff family.
  it.each`
    units               | expected
    ${"day"}            | ${1}
    ${"days"}           | ${1}
    ${"hour"}           | ${25}
    ${["day", "hour"]}  | ${{ days: 1, hours: 1 }}
    ${["days", "hour"]} | ${{ days: 1, hours: 1 }}
  `(
    "returns $expected for 0 to 90000000 in units $units",
    ({ units, expected }) => {
      expect(diffUnix(0, 90000000, units, { timeZone: "UTC" })).toEqual(
        expected,
      );
    },
  );

  // An empty units list names no largest unit (getLargestDateTimeDurationUnit returns ""), so there
  // is nothing to measure: invalid input.
  it("returns null for an empty units list", () => {
    expect(diffUnix(0, 604_800, [])).toBeNull();
  });
});

// Plan #16: a units array returns the whole difference; unlisted units between listed ones are
// carried into the next smaller listed unit. Values from native Temporal (Chromium 153):
// 1704067200000 ms (2024-01-01T00:00Z) until 1740787200000 ms (2025-03-01T00:00Z) is P1Y2M in UTC
// (59 days after the year); in New York it is 2023-12-31T19:00-05:00 until 2025-02-28T19:00-05:00,
// P1Y1M28D, and 2024-12-31T19:00 to 2025-02-28T19:00 is 1416 hours (59 days).
describe("diffUnix units array carries unlisted units", () => {
  it.each`
    timeZone              | units                | expected
    ${"UTC"}              | ${["years", "days"]} | ${{ years: 1, days: 59 }}
    ${"America/New_York"} | ${["year", "hour"]}  | ${{ years: 1, hours: 1416 }}
  `(
    "returns $expected for $units from 1704067200000 to 1740787200000 ms in $timeZone",
    ({ timeZone, units, expected }) => {
      expect(
        diffUnix(1704067200000, 1740787200000, units, {
          epochUnit: "milliseconds",
          timeZone,
        }),
      ).toEqual(expected);
    },
  );

  // Temporal fills weeks only when largestUnit is weeks. 2024-01-01T00:00Z until 2024-03-20T00:00Z
  // is P2M19D and 2024-03-01 until 2024-03-20 is P2W5D; 2024-02-29T23:59:59.999Z (1709251199999)
  // until 2024-01-31T23:59:59.999Z (1706745599999) is -P29D (no years, 4 weeks).
  it.each`
    value1           | value2           | units                  | expected
    ${1704067200000} | ${1710892800000} | ${["months", "weeks"]} | ${{ months: 2, weeks: 2 }}
    ${1709251199999} | ${1706745599999} | ${["years", "weeks"]}  | ${{ years: 0, weeks: -4 }}
  `(
    "returns $expected for $units from $value1 to $value2 ms in UTC",
    ({ value1, value2, units, expected }) => {
      expect(diffUnix(value1, value2, units)).toEqual(expected);
    },
  );
});

// Temporal GetOptionsObject: an options argument that is not an object or undefined throws
// TypeError (native Chromium 153: `until(other, null)`, `"x"`, `5` and `true` all throw), so each is
// invalid input. Omitted options measure normally (PT25H).
describe("diffUnix with a non-object options argument", () => {
  it.each`
    options      | expected
    ${null}      | ${null}
    ${"x"}       | ${null}
    ${5}         | ${null}
    ${true}      | ${null}
    ${undefined} | ${25}
  `("returns $expected for options $options", ({ options, expected }) => {
    expect(diffUnix(0, 90000000, "hours", options)).toBe(expected);
  });
});

// Unix input is whole milliseconds or seconds, so every nanosecond result this function can return
// is exactly representable — but past about 104 days it is no longer a safe integer, and
// arithmetic on it silently loses nanoseconds. Pinned so the JSDoc's bigint advice stays true.
describe("diffUnix nanosecond precision past Number.MAX_SAFE_INTEGER", () => {
  it("returns an exact but unsafe integer for a 105-day span", () => {
    const ns = diffUnix(0, 9_072_000_000, "nanoseconds") as number;

    expect(ns).toBe(9_072_000_000_000_000);
    expect(Number.isSafeInteger(ns)).toBe(false);
    expect(ns + 1).toBe(ns);
  });

  it("is still a safe integer at 104 days", () => {
    expect(
      Number.isSafeInteger(diffUnix(0, 8_985_600_000, "nanoseconds") as number),
    ).toBe(true);
  });
});
