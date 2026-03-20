import { diffTime } from "./diffTime";

describe("diffTime", () => {
  it.each`
    time1         | time2                   | unit             | expected
    ${"00:00:00"} | ${"01:00:00"}           | ${"hour"}        | ${1}
    ${"00:00:00"} | ${"12:00:00"}           | ${"hour"}        | ${12}
    ${"12:30:45"} | ${"13:30:45"}           | ${"hour"}        | ${1}
    ${"00:00:00"} | ${"00:01:00"}           | ${"minute"}      | ${1}
    ${"00:00:00"} | ${"00:30:00"}           | ${"minute"}      | ${30}
    ${"00:00:00"} | ${"00:00:01"}           | ${"second"}      | ${1}
    ${"00:00:00"} | ${"00:00:59"}           | ${"second"}      | ${59}
    ${"00:00:00"} | ${"00:00:00.001"}       | ${"millisecond"} | ${1}
    ${"00:00:00"} | ${"00:00:00.000001"}    | ${"microsecond"} | ${1}
    ${"00:00:00"} | ${"00:00:00.000000001"} | ${"nanosecond"}  | ${1}
    ${"00:00:00"} | ${"00:00:00"}           | ${"second"}      | ${0}
  `(
    "returns $expected for $unit comparing $time1, $time2",
    ({ time1, time2, unit, expected }) => {
      expect(diffTime(time1, time2, unit)).toBe(expected);
    },
  );

  it.each`
    time1             | time2         | unit             | expected
    ${"00:00:00.999"} | ${"00:00:01"} | ${"millisecond"} | ${1}
    ${"12:00:00"}     | ${"12:00:00"} | ${"hour"}        | ${0}
    ${"23:59:59"}     | ${"23:59:59"} | ${"second"}      | ${0}
  `(
    "returns $expected for edge cases: $unit comparing $time1, $time2",
    ({ time1, time2, unit, expected }) => {
      expect(diffTime(time1, time2, unit)).toBe(expected);
    },
  );

  it.each`
    time1         | time2
    ${"12:00:00"} | ${"00:00:00"}
    ${"23:59:59"} | ${"12:00:00"}
    ${"01:30:00"} | ${"00:00:00"}
  `(
    "returns negative difference for time1 after time2: $time1, $time2",
    ({ time1, time2 }) => {
      expect(diffTime(time1, time2, "second")).toBeLessThan(0);
    },
  );

  it.each`
    invalidTime1
    ${"25:00:00"}
    ${"not-a-time"}
    ${"12:60:00"}
    ${"12:00:61"}
    ${""}
    ${true}
    ${null}
    ${undefined}
  `("returns null for invalid time1", ({ invalidTime1 }) => {
    expect(diffTime(invalidTime1 as never, "12:00:00", "hour")).toBeNull();
  });

  it.each`
    invalidTime2
    ${"25:00:00"}
    ${"not-a-time"}
    ${"12:60:00"}
    ${"12:00:61"}
    ${""}
    ${true}
    ${null}
    ${undefined}
  `("returns null for invalid time2", ({ invalidTime2 }) => {
    expect(diffTime("12:00:00", invalidTime2 as never, "hour")).toBeNull();
  });

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${"hours"}
    ${"minutes"}
    ${"seconds"}
    ${"day"}
    ${"week"}
  `("returns null for invalid unit", ({ invalidUnit }) => {
    expect(diffTime("12:00:00", "13:00:00", invalidUnit as never)).toBeNull();
  });
});
