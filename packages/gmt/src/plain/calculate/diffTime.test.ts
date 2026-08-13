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
    ${"hour"}
    ${"minute"}
    ${"second"}
    ${"day"}
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
});
