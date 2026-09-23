import { diffTime } from "./diffTime";

describe("diffTime", () => {
  it.each`
    time1         | time2                   | unit              | expected
    ${"00:00:00"} | ${"01:00:00"}           | ${"hours"}        | ${1}
    ${"00:00:00"} | ${"12:00:00"}           | ${"hours"}        | ${12}
    ${"12:30:45"} | ${"13:30:45"}           | ${"hours"}        | ${1}
    ${"00:00:00"} | ${"00:01:00"}           | ${"minutes"}      | ${1}
    ${"00:00:00"} | ${"00:30:00"}           | ${"minutes"}      | ${30}
    ${"00:00:00"} | ${"00:00:01"}           | ${"seconds"}      | ${1}
    ${"00:00:00"} | ${"00:00:59"}           | ${"seconds"}      | ${59}
    ${"00:00:00"} | ${"00:00:00.001"}       | ${"milliseconds"} | ${1}
    ${"00:00:00"} | ${"00:00:00.000001"}    | ${"microseconds"} | ${1}
    ${"00:00:00"} | ${"00:00:00.000000001"} | ${"nanoseconds"}  | ${1}
    ${"00:00:00"} | ${"00:00:00"}           | ${"seconds"}      | ${0}
  `(
    "returns int $expected for single $unit comparing $time1, $time2",
    ({ time1, time2, unit, expected }) => {
      expect(diffTime(time1, time2, unit)).toEqual(expected);
    },
  );

  it.each`
    time1         | time2         | expected
    ${"12:00:00"} | ${"00:00:00"} | ${{ hours: -12 }}
    ${"23:59:59"} | ${"12:00:00"} | ${{ hours: -11 }}
    ${"01:30:00"} | ${"00:00:00"} | ${{ hours: -1 }}
  `(
    "returns negative difference for time1 after time2: $time1, $time2",
    ({ time1, time2, expected }) => {
      expect(diffTime(time1, time2, ["hours"])).toEqual(expected);
    },
  );

  it.each`
    nonStringInput
    ${"25:00:00"}
    ${"not-a-time"}
    ${"12:60:00"}
    ${"12:00:61"}
    ${""}
    ${true}
    ${null}
    ${undefined}
  `(
    "returns null for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(
        diffTime(nonStringInput as never, "12:00:00", ["hours"]),
      ).toBeNull();
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${"week"}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(diffTime("12:00:00", "13:00:00", [invalidUnit] as never)).toBeNull();
  });

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${45}
    ${"floor"}      | ${30}
    ${"trunc"}      | ${30}
    ${"halfExpand"} | ${30}
    ${"halfCeil"}   | ${30}
    ${"halfFloor"}  | ${30}
    ${"halfTrunc"}  | ${30}
    ${"halfEven"}   | ${30}
    ${"expand"}     | ${45}
  `(
    "rounds a 32-minute span to $expected minutes with smallestUnit minute, roundingIncrement 15, roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        diffTime("00:00:00", "00:32:00", "minutes", {
          smallestUnit: "minutes",
          roundingIncrement: 15,
          roundingMode,
        }),
      ).toBe(expected);
    },
  );

  it("returns the unrounded result when no options are provided", () => {
    expect(diffTime("00:00:00", "00:32:00", "minutes")).toBe(32);
  });

  it("returns null when roundingIncrement does not evenly divide the unit (minutes must divide 60)", () => {
    expect(
      diffTime("00:00:00", "00:32:00", "minutes", {
        smallestUnit: "minutes",
        roundingIncrement: 7,
        roundingMode: "trunc",
      }),
    ).toBeNull();
  });

  it("rounds a negative diff (time1 after time2)", () => {
    expect(
      diffTime("00:32:00", "00:00:00", "minutes", {
        smallestUnit: "minutes",
        roundingIncrement: 15,
        roundingMode: "halfExpand",
      }),
    ).toBe(-30);
  });

  it("rounds a zero-length diff to zero", () => {
    expect(
      diffTime("00:00:00", "00:00:00", "minutes", {
        smallestUnit: "minutes",
        roundingMode: "halfExpand",
      }),
    ).toBe(0);
  });

  it("rounds a result requested as an array of units", () => {
    expect(
      diffTime("00:00:00", "01:45:00", ["hours", "minutes"], {
        smallestUnit: "minutes",
        roundingIncrement: 30,
        roundingMode: "halfExpand",
      }),
    ).toEqual({ hours: 2, minutes: 0 });
  });

  it("returns the unrounded array-of-units result when no options are provided", () => {
    expect(diffTime("00:00:00", "01:45:00", ["hours", "minutes"])).toEqual({
      hours: 1,
      minutes: 45,
    });
  });

  it("returns null when smallestUnit is coarser than the largest requested unit", () => {
    expect(
      diffTime("00:00:00", "01:45:00", ["minutes", "seconds"], {
        smallestUnit: "hours",
      }),
    ).toBeNull();
  });

  // Temporal §13.17 GetTemporalUnitValuedOption: a singular unit name is the same unit as its plural.
  // 10:00 to 11:30 is 1 hour 30 minutes: 90 minutes, 5400 seconds.
  it.each`
    unit                  | expected
    ${"hour"}             | ${1}
    ${"minute"}           | ${90}
    ${"second"}           | ${5400}
    ${["hour", "minute"]} | ${{ hours: 1, minutes: 30 }}
  `(
    "returns $expected for singular unit $unit from 10:00 to 11:30",
    ({ unit, expected }) => {
      expect(diffTime("10:00:00", "11:30:00", unit)).toEqual(expected);
    },
  );
});

// Plan #16: a units array returns the whole difference. The amount of each unlisted unit between
// two listed units is carried into the next smaller listed unit; units smaller than the smallest
// listed unit are dropped (truncated), as for a single unit. Values from native Temporal
// (Chromium 153): 10:00:00 until 11:30:15 is PT1H30M15S, and PT30M15S totals 1815 seconds;
// 23:59:10 until 23:59:59 rounded to the minute (halfExpand) is PT1M, which runs past midnight.
describe("diffTime units array carries unlisted units", () => {
  it.each`
    time1         | time2           | units                   | options                                                   | expected
    ${"10:00:00"} | ${"11:30:15"}   | ${["hours", "seconds"]} | ${undefined}                                              | ${{ hours: 1, seconds: 1815 }}
    ${"10:00:00"} | ${"11:30:15"}   | ${["seconds", "hours"]} | ${undefined}                                              | ${{ seconds: 1815, hours: 1 }}
    ${"11:30:15"} | ${"10:00:00"}   | ${["hours", "seconds"]} | ${undefined}                                              | ${{ hours: -1, seconds: -1815 }}
    ${"00:00:00"} | ${"01:45:30.5"} | ${["hour", "second"]}   | ${undefined}                                              | ${{ hours: 1, seconds: 2730 }}
    ${"10:00:00"} | ${"11:30:45"}   | ${["hours", "seconds"]} | ${{ smallestUnit: "minute", roundingMode: "halfExpand" }} | ${{ hours: 1, seconds: 1860 }}
    ${"23:59:10"} | ${"23:59:59"}   | ${["hours", "seconds"]} | ${{ smallestUnit: "minute", roundingMode: "halfExpand" }} | ${{ hours: 0, seconds: 60 }}
    ${"10:00:00"} | ${"11:30:15"}   | ${["hours", "minutes"]} | ${undefined}                                              | ${{ hours: 1, minutes: 30 }}
  `(
    "returns $expected for $units from $time1 to $time2 with options $options",
    ({ time1, time2, units, options, expected }) => {
      expect(diffTime(time1, time2, units, options)).toEqual(expected);
    },
  );
});

// Temporal GetOptionsObject: an options argument that is not an object or undefined throws
// TypeError (native Chromium 153: `until(other, null)`, `"x"`, `5` and `true` all throw), so each is
// invalid input. Omitted options measure normally (PT1H).
describe("diffTime with a non-object options argument", () => {
  it.each`
    options      | expected
    ${null}      | ${null}
    ${"x"}       | ${null}
    ${5}         | ${null}
    ${true}      | ${null}
    ${undefined} | ${1}
  `("returns $expected for options $options", ({ options, expected }) => {
    expect(diffTime("01:00:00", "02:00:00", "hours", options)).toBe(expected);
  });
});

// Two plain times are less than a day apart, so unlike diffDateTime/diffUtc/diffUnix a nanosecond
// result here is always a safe integer. Pinned so the JSDoc's guarantee stays true.
describe("diffTime nanosecond precision", () => {
  it.each`
    time1                   | time2                   | expected
    ${"00:00:00.000000000"} | ${"23:59:59.999999999"} | ${86_399_999_999_999}
    ${"23:59:59.999999999"} | ${"00:00:00.000000000"} | ${-86_399_999_999_999}
  `(
    "returns the exact $expected nanoseconds from $time1 to $time2",
    ({ time1, time2, expected }) => {
      const ns = diffTime(time1, time2, "nanoseconds") as number;

      expect(ns).toBe(expected);
      expect(Number.isSafeInteger(ns)).toBe(true);
    },
  );
});
