import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { mockSystemTimeZone } from "../../test/timeZoneMatrix";
import { diffUnixAsDuration } from "./diffUnixAsDuration";

describe("diffUnixAsDuration", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = mockSystemTimeZone("UTC");
  });

  afterEach(() => {
    cleanup();
  });

  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      expected: "PT2H",
    })),
  )(
    "rounds a 90-minute span to $expected across battle-test timeZone $timeZone",
    ({ timeZone, expected }) => {
      expect(
        diffUnixAsDuration(1709164800000, 1709170200000, "hours", {
          smallestUnit: "hours",
          roundingMode: "halfExpand",
          timeZone,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    value1        | value2        | unit       | expected
    ${1704067200} | ${1704153600} | ${"days"}  | ${"P1D"}
    ${1704067200} | ${1704153600} | ${"hours"} | ${"PT24H"}
    ${1704067200} | ${1704153600} | ${"weeks"} | ${"P1D"}
  `(
    "returns $expected for single unit difference between $value1 and $value2 for unit $unit",
    ({ value1, value2, unit, expected }) => {
      expect(
        diffUnixAsDuration(value1, value2, unit, { epochUnit: "seconds" }),
      ).toBe(expected);
    },
  );

  it.each`
    value1           | value2           | unit      | expected
    ${1704067200000} | ${1704153600000} | ${"days"} | ${"P1D"}
    ${1704153600000} | ${1704067200000} | ${"days"} | ${"-P1D"}
  `(
    "handles direction correctly: $expected for $value1 -> $value2",
    ({ value1, value2, unit, expected }) => {
      expect(diffUnixAsDuration(value1, value2, unit)).toBe(expected);
    },
  );

  it("supports seconds epochUnit", () => {
    expect(
      diffUnixAsDuration(1704067200, 1704153600, "days", {
        epochUnit: "seconds",
      }),
    ).toBe("P1D");
  });

  it.each`
    value1        | value2
    ${NaN}        | ${1704153600}
    ${1704067200} | ${NaN}
    ${null}       | ${1704153600}
    ${1704067200} | ${null}
  `(
    'returns "" for invalid inputs: $value1 | $value2',
    ({ value1, value2 }) => {
      expect(diffUnixAsDuration(value1 as never, value2 as never, "days")).toBe(
        "",
      );
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${["days"]}
  `('returns "" for invalid unit $invalidUnit', ({ invalidUnit }) => {
    expect(
      diffUnixAsDuration(1704067200000, 1704153600000, invalidUnit as never),
    ).toBe("");
  });

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${"PT2H"}
    ${"floor"}      | ${"PT1H"}
    ${"trunc"}      | ${"PT1H"}
    ${"halfExpand"} | ${"PT2H"}
  `(
    "rounds a 90-minute span to $expected with smallestUnit hour, roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        diffUnixAsDuration(1709164800000, 1709170200000, "hours", {
          smallestUnit: "hours",
          roundingMode,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    roundingMode | expected
    ${"ceil"}    | ${"PT2H"}
    ${"floor"}   | ${"PT1H"}
  `(
    "rounds a 90-minute span to $expected across a DST-observing timeZone (America/New_York)",
    ({ roundingMode, expected }) => {
      expect(
        diffUnixAsDuration(1709164800000, 1709170200000, "hours", {
          smallestUnit: "hours",
          roundingMode,
          timeZone: "America/New_York",
        }),
      ).toBe(expected);
    },
  );

  it("returns the unrounded result when no rounding options are provided", () => {
    expect(
      diffUnixAsDuration(1704067200, 1704073200, "minutes", {
        epochUnit: "seconds",
      }),
    ).toBe("PT100M");
  });

  it('returns "" when roundingIncrement does not evenly divide the unit', () => {
    expect(
      diffUnixAsDuration(1704067200, 1704073200, "minutes", {
        epochUnit: "seconds",
        smallestUnit: "minutes",
        roundingIncrement: 7,
        roundingMode: "trunc",
      }),
    ).toBe("");
  });

  it("returns negative duration for value1 after value2", () => {
    expect(
      diffUnixAsDuration(1709170200000, 1709164800000, "hours", {
        smallestUnit: "hours",
        roundingMode: "halfExpand",
      }),
    ).toBe("-PT2H");
  });

  it.each`
    toStringSmallestUnit | fractionalSecondDigits | expected
    ${undefined}         | ${undefined}           | ${"PT1H"}
    ${"second"}          | ${undefined}           | ${"PT1H0S"}
    ${undefined}         | ${3}                   | ${"PT1H0.000S"}
  `(
    "applies toString precision options -> $expected",
    ({ toStringSmallestUnit, fractionalSecondDigits, expected }) => {
      expect(
        diffUnixAsDuration(1709164800000, 1709168400000, "hours", {
          toStringSmallestUnit,
          fractionalSecondDigits,
        }),
      ).toBe(expected);
    },
  );

  it("returns null when Temporal.Instant.fromEpochMilliseconds throws", () => {
    vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(
      () => {
        throw new Error("simulated failure");
      },
    );
    expect(diffUnixAsDuration(1709164800000, 1709170200000, "hours")).toBe("");
  });
});

// The last representable instant, +275760-09-13T00:00:00Z, in epoch milliseconds (TC39 nsMaxInstant).
const MAX_MS = 8_640_000_000_000_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

describe("diffUnixAsDuration at the maximum instant", () => {
  // TC39 DifferenceZonedDateTime: 40 days back from the maximum is +275760-08-04 local, one
  // month to +275760-09-04 and 9 more days to the 13th; the end's wall clock runs past the
  // maximum in a zone ahead of UTC, but its exact time is in range.
  it.each`
    value1                  | value2    | unit        | timeZone                | expected
    ${MAX_MS - 40 * DAY_MS} | ${MAX_MS} | ${"months"} | ${"Australia/Sydney"}   | ${"P1M9D"}
    ${MAX_MS - 40 * DAY_MS} | ${MAX_MS} | ${"months"} | ${"Pacific/Kiritimati"} | ${"P1M9D"}
    ${MAX_MS - DAY_MS}      | ${MAX_MS} | ${"days"}   | ${"Australia/Sydney"}   | ${"P1D"}
  `(
    "returns $expected in $unit from $value1 to $value2 in $timeZone",
    ({ value1, value2, unit, timeZone, expected }) => {
      expect(diffUnixAsDuration(value1, value2, unit, { timeZone })).toBe(
        expected,
      );
    },
  );

  // TC39 NudgeToCalendarUnit: rounding to a day looks past the last representable date.
  it("returns an empty string rounding days to a day from max - 1d to max in Australia/Sydney", () => {
    expect(
      diffUnixAsDuration(MAX_MS - DAY_MS, MAX_MS, "days", {
        timeZone: "Australia/Sydney",
        smallestUnit: "day",
      }),
    ).toBe("");
  });

  // TC39 NudgeToZonedTime: rounding P3DT5H to an hour resolves a wall clock 19 hours past the
  // maximum, which GetPossibleEpochNanoseconds rejects in every zone, UTC included.
  it.each`
    timeZone
    ${"UTC"}
    ${"Europe/London"}
  `(
    "returns an empty string rounding to an hour from max - 3d5h to max in $timeZone",
    ({ timeZone }) => {
      expect(
        diffUnixAsDuration(MAX_MS - 3 * DAY_MS - 5 * HOUR_MS, MAX_MS, "days", {
          timeZone,
          smallestUnit: "hour",
        }),
      ).toBe("");
    },
  );

  it.each`
    timeZone
    ${"UTC"}
    ${"Europe/London"}
  `(
    "returns P5DT5H rounding to an hour from max - 10d5h to max - 5d in $timeZone",
    ({ timeZone }) => {
      expect(
        diffUnixAsDuration(
          MAX_MS - 10 * DAY_MS - 5 * HOUR_MS,
          MAX_MS - 5 * DAY_MS,
          "days",
          { timeZone, smallestUnit: "hour" },
        ),
      ).toBe("P5DT5H");
    },
  );
});

// The first representable instant, -271821-04-20T00:00:00Z, in epoch milliseconds (TC39 nsMinInstant).
const MIN_MS = -MAX_MS;

describe("diffUnixAsDuration at the minimum instant", () => {
  // TC39 DifferenceZonedDateTime: 40 days after the minimum is -271821-05-29 local; back one month
  // to -271821-04-29 and 10 more days to the 19th, where the minimum's wall clock falls in a zone
  // behind UTC.
  it.each`
    timeZone
    ${"America/New_York"}
    ${"Pacific/Honolulu"}
  `(
    "returns -P1M10D in months from min + 40d to min in $timeZone",
    ({ timeZone }) => {
      expect(
        diffUnixAsDuration(MIN_MS + 40 * DAY_MS, MIN_MS, "months", {
          timeZone,
        }),
      ).toBe("-P1M10D");
    },
  );
});

describe("diffUnixAsDuration with an unrecognised epochUnit", () => {
  // isValidUnixUnit defines the domain ("seconds" | "milliseconds", singular or plural): any other value is invalid
  // input and returns the sentinel, never a silent read as milliseconds.
  it.each`
    epochUnit
    ${"nanoseconds"}
    ${"SECONDS"}
    ${"ms"}
    ${""}
    ${1000}
  `('returns "" for epochUnit $epochUnit', ({ epochUnit }) => {
    expect(
      diffUnixAsDuration(1_706_659_200, 1_706_659_200, "days", {
        epochUnit: epochUnit as never,
        timeZone: "UTC",
      }),
    ).toBe("");
  });
});

describe("diffUnixAsDuration unit names", () => {
  // Temporal §13.17: largestUnit "day" and "days" are the same unit. 90000000 ms is P1DT1H in UTC.
  it.each`
    unit      | expected
    ${"day"}  | ${"P1DT1H"}
    ${"days"} | ${"P1DT1H"}
  `(
    "returns $expected for 0 to 90000000 in unit $unit",
    ({ unit, expected }) => {
      expect(diffUnixAsDuration(0, 90000000, unit, { timeZone: "UTC" })).toBe(
        expected,
      );
    },
  );
});

// Temporal GetOptionsObject: an options argument that is not an object or undefined throws
// TypeError (native Chromium 153: `until(other, null)`, `"x"`, `5` and `true` all throw), so each is
// invalid input. Omitted options measure normally (PT25H).
describe("diffUnixAsDuration with a non-object options argument", () => {
  it.each`
    options      | expected
    ${null}      | ${""}
    ${"x"}       | ${""}
    ${5}         | ${""}
    ${true}      | ${""}
    ${undefined} | ${"PT25H"}
  `("returns $expected for options $options", ({ options, expected }) => {
    expect(diffUnixAsDuration(0, 90000000, "hours", options)).toBe(expected);
  });
});
