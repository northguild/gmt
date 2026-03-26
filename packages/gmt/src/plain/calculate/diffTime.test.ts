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
    time1         | time2                   | unit                | expected
    ${"00:00:00"} | ${"01:00:00"}           | ${["hours"]}        | ${{ hours: 1 }}
    ${"00:00:00"} | ${"12:00:00"}           | ${["hours"]}        | ${{ hours: 12 }}
    ${"12:30:45"} | ${"13:30:45"}           | ${["hours"]}        | ${{ hours: 1 }}
    ${"00:00:00"} | ${"00:01:00"}           | ${["minutes"]}      | ${{ minutes: 1 }}
    ${"00:00:00"} | ${"00:30:00"}           | ${["minutes"]}      | ${{ minutes: 30 }}
    ${"00:00:00"} | ${"00:00:01"}           | ${["seconds"]}      | ${{ seconds: 1 }}
    ${"00:00:00"} | ${"00:00:59"}           | ${["seconds"]}      | ${{ seconds: 59 }}
    ${"00:00:00"} | ${"00:00:00.001"}       | ${["milliseconds"]} | ${{ milliseconds: 1 }}
    ${"00:00:00"} | ${"00:00:00.000001"}    | ${["microseconds"]} | ${{ microseconds: 1 }}
    ${"00:00:00"} | ${"00:00:00.000000001"} | ${["nanoseconds"]}  | ${{ nanoseconds: 1 }}
    ${"00:00:00"} | ${"00:00:00"}           | ${["seconds"]}      | ${{ seconds: 0 }}
  `(
    "returns $expected for $unit comparing $time1, $time2",
    ({ time1, time2, unit, expected }) => {
      expect(diffTime(time1, time2, unit)).toEqual(expected);
    },
  );

  it.each`
    time1             | time2         | unit                | expected
    ${"00:00:00.999"} | ${"00:00:01"} | ${["milliseconds"]} | ${{ milliseconds: 1 }}
    ${"12:00:00"}     | ${"12:00:00"} | ${["hours"]}        | ${{ hours: 0 }}
    ${"23:59:59"}     | ${"23:59:59"} | ${["seconds"]}      | ${{ seconds: 0 }}
  `(
    "returns $expected for edge cases: $unit comparing $time1, $time2",
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
    expect(diffTime(invalidTime1 as never, "12:00:00", ["hours"])).toBeNull();
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
    expect(diffTime("12:00:00", invalidTime2 as never, ["hours"])).toBeNull();
  });

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
  `("returns null for invalid unit", ({ invalidUnit }) => {
    expect(diffTime("12:00:00", "13:00:00", [invalidUnit] as never)).toBeNull();
  });
});
