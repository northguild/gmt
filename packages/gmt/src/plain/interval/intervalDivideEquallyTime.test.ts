import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { intervalDivideEquallyTime } from "./intervalDivideEquallyTime";

describe("intervalDivideEquallyTime", () => {
  it.each`
    start         | end           | n    | expected
    ${"09:00:00"} | ${"17:00:00"} | ${4} | ${[{ start: "09:00:00", end: "11:00:00" }, { start: "11:00:00", end: "13:00:00" }, { start: "13:00:00", end: "15:00:00" }, { start: "15:00:00", end: "17:00:00" }]}
    ${"09:00:00"} | ${"17:00:00"} | ${3} | ${[{ start: "09:00:00", end: "11:40:00" }, { start: "11:40:00", end: "14:20:00" }, { start: "14:20:00", end: "17:00:00" }]}
    ${"09:00:00"} | ${"17:00:00"} | ${1} | ${[{ start: "09:00:00", end: "17:00:00" }]}
    ${"09:00:00"} | ${"09:00:00"} | ${2} | ${[{ start: "09:00:00", end: "09:00:00" }, { start: "09:00:00", end: "09:00:00" }]}
  `(
    "splits $start..$end into $n parts as $expected",
    ({ start, end, n, expected }) => {
      expect(intervalDivideEquallyTime(start, end, n)).toEqual(expected);
    },
  );

  // 1 second does not divide evenly by 3: boundaries are computed to nanosecond precision, so
  // the split is exact to the nanosecond. Verified against real @js-temporal/polyfill: 1e9 ns / 3
  // rounds to 333333333 and 666666667 ns.
  it("splits to nanosecond precision when the total does not divide evenly by n", () => {
    expect(intervalDivideEquallyTime("00:00:00", "00:00:01", 3)).toEqual([
      { start: "00:00:00", end: "00:00:00.333333333" },
      { start: "00:00:00.333333333", end: "00:00:00.666666667" },
      { start: "00:00:00.666666667", end: "00:00:01" },
    ]);
  });

  it.each`
    n
    ${0}
    ${-1}
    ${1.5}
    ${NaN}
    ${"3"}
    ${null}
    ${undefined}
    ${true}
  `("returns [] for invalid n = $n", ({ n }) => {
    expect(intervalDivideEquallyTime("09:00:00", "17:00:00", n)).toEqual([]);
  });

  it.each`
    start         | end           | n
    ${"invalid"}  | ${"17:00:00"} | ${3}
    ${"17:00:00"} | ${"09:00:00"} | ${3}
  `("returns [] for invalid $start, $end", ({ start, end, n }) => {
    expect(intervalDivideEquallyTime(start, end, n)).toEqual([]);
  });

  it("returns [] when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(intervalDivideEquallyTime("09:00:00", "17:00:00", 3)).toEqual([]);
  });
});
