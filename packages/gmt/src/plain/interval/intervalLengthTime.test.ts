import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { intervalLengthTime } from "./intervalLengthTime";

describe("intervalLengthTime", () => {
  it.each`
    start              | end               | unit             | expected
    ${"12:00:00"}      | ${"14:30:00"}     | ${"hour"}        | ${2.5}
    ${"12:59:00"}      | ${"13:01:00"}     | ${"hour"}        | ${2 / 60}
    ${"12:00:00"}      | ${"12:30:00"}     | ${"minute"}      | ${30}
    ${"12:00:00.500"}  | ${"12:00:01.750"} | ${"second"}      | ${1.25}
    ${"12:00:00"}      | ${"12:00:00.001"} | ${"millisecond"} | ${1}
  `(
    "returns $expected $unit for $start..$end",
    ({ start, end, unit, expected }) => {
      expect(intervalLengthTime(start, end, unit)).toBeCloseTo(expected, 10);
    },
  );

  it("returns 0 for a zero-length interval", () => {
    expect(intervalLengthTime("12:00:00", "12:00:00", "hour")).toBe(0);
  });

  it.each`
    start         | end           | unit
    ${"invalid"}  | ${"14:00:00"} | ${"hour"}
    ${"14:00:00"} | ${"12:00:00"} | ${"hour"}
    ${"12:00:00"} | ${"14:00:00"} | ${"day"}
  `(
    "returns null for invalid $start, $end, or $unit",
    ({ start, end, unit }) => {
      expect(intervalLengthTime(start, end, unit)).toBeNull();
    },
  );

  it.each`
    start   | end           | unit
    ${123}  | ${"14:00:00"} | ${"hour"}
    ${null} | ${"14:00:00"} | ${"hour"}
  `("returns null for wrong-type start $start", ({ start, end, unit }) => {
    expect(intervalLengthTime(start as never, end, unit)).toBeNull();
  });

  it("returns null when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(intervalLengthTime("12:00:00", "14:00:00", "hour")).toBeNull();
  });
});
