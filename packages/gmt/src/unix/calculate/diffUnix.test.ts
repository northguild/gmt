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
  // isValidUnixUnit defines the domain ("seconds" | "milliseconds"): any other value is invalid
  // input and returns the sentinel, never a silent read as milliseconds.
  it.each`
    epochUnit
    ${"second"}
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
