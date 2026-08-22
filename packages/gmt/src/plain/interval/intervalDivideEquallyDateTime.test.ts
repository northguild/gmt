import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { intervalDivideEquallyDateTime } from "./intervalDivideEquallyDateTime";

describe("intervalDivideEquallyDateTime", () => {
  it.each`
    start                    | end                      | n    | expected
    ${"2024-01-01T00:00:00"} | ${"2024-01-04T00:00:00"} | ${3} | ${[{ start: "2024-01-01T00:00:00", end: "2024-01-02T00:00:00" }, { start: "2024-01-02T00:00:00", end: "2024-01-03T00:00:00" }, { start: "2024-01-03T00:00:00", end: "2024-01-04T00:00:00" }]}
    ${"2024-01-01T00:00:00"} | ${"2024-01-04T00:00:00"} | ${1} | ${[{ start: "2024-01-01T00:00:00", end: "2024-01-04T00:00:00" }]}
    ${"2024-01-01T00:00:00"} | ${"2024-01-01T00:00:00"} | ${2} | ${[{ start: "2024-01-01T00:00:00", end: "2024-01-01T00:00:00" }, { start: "2024-01-01T00:00:00", end: "2024-01-01T00:00:00" }]}
  `(
    "splits $start..$end into $n parts as $expected",
    ({ start, end, n, expected }) => {
      expect(intervalDivideEquallyDateTime(start, end, n)).toEqual(expected);
    },
  );

  // 1 second does not divide evenly by 3: boundaries are computed from total elapsed
  // nanoseconds, so the split is exact to the nanosecond rather than day-rounded. Verified
  // against real @js-temporal/polyfill: 1e9 ns / 3 rounds to 333333333 and 666666667 ns.
  it("splits to nanosecond precision when the total does not divide evenly by n", () => {
    expect(
      intervalDivideEquallyDateTime(
        "2024-01-01T00:00:00",
        "2024-01-01T00:00:01",
        3,
      ),
    ).toEqual([
      { start: "2024-01-01T00:00:00", end: "2024-01-01T00:00:00.333333333" },
      {
        start: "2024-01-01T00:00:00.333333333",
        end: "2024-01-01T00:00:00.666666667",
      },
      { start: "2024-01-01T00:00:00.666666667", end: "2024-01-01T00:00:01" },
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
    expect(
      intervalDivideEquallyDateTime(
        "2024-01-01T00:00:00",
        "2024-01-04T00:00:00",
        n,
      ),
    ).toEqual([]);
  });

  it.each`
    start                    | end
    ${"invalid"}             | ${"2024-01-04T00:00:00"}
    ${"2024-01-04T00:00:00"} | ${"2024-01-01T00:00:00"}
  `("returns [] for invalid $start, $end", ({ start, end }) => {
    expect(intervalDivideEquallyDateTime(start, end, 3)).toEqual([]);
  });

  it("returns [] when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      intervalDivideEquallyDateTime(
        "2024-01-01T00:00:00",
        "2024-01-04T00:00:00",
        3,
      ),
    ).toEqual([]);
  });
});
