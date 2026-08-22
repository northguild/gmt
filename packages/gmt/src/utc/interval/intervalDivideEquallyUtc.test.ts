import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { intervalDivideEquallyUtc } from "./intervalDivideEquallyUtc";

describe("intervalDivideEquallyUtc", () => {
  it.each`
    start                       | end                         | n    | expected
    ${"2024-01-01T00:00:00Z"}   | ${"2024-01-04T00:00:00Z"}   | ${3} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }, { start: "2024-01-02T00:00:00Z", end: "2024-01-03T00:00:00Z" }, { start: "2024-01-03T00:00:00Z", end: "2024-01-04T00:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"}   | ${"2024-01-04T00:00:00Z"}   | ${1} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-04T00:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"}   | ${"2024-01-01T00:00:00Z"}   | ${2} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" }, { start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" }]}
  `(
    "splits $start..$end into $n parts as $expected",
    ({ start, end, n, expected }) => {
      expect(intervalDivideEquallyUtc(start, end, n)).toEqual(expected);
    },
  );

  // 1 second does not divide evenly by 3: boundaries are computed from total elapsed
  // nanoseconds, so the split is exact to the nanosecond rather than day-rounded. Verified
  // against real @js-temporal/polyfill: 1e9 ns / 3 rounds to 333333333 and 666666667 ns.
  it("splits to nanosecond precision when the total does not divide evenly by n", () => {
    expect(
      intervalDivideEquallyUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-01T00:00:01Z",
        3,
      ),
    ).toEqual([
      { start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00.333333333Z" },
      {
        start: "2024-01-01T00:00:00.333333333Z",
        end: "2024-01-01T00:00:00.666666667Z",
      },
      { start: "2024-01-01T00:00:00.666666667Z", end: "2024-01-01T00:00:01Z" },
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
      intervalDivideEquallyUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-04T00:00:00Z",
        n,
      ),
    ).toEqual([]);
  });

  it.each`
    start                     | end
    ${"invalid"}              | ${"2024-01-04T00:00:00Z"}
    ${"2024-01-04T00:00:00Z"} | ${"2024-01-01T00:00:00Z"}
    ${"2024-12-31T23:59:60Z"} | ${"2024-01-04T00:00:00Z"}
  `("returns [] for invalid $start, $end", ({ start, end }) => {
    expect(intervalDivideEquallyUtc(start, end, 3)).toEqual([]);
  });

  it("returns [] when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      intervalDivideEquallyUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-04T00:00:00Z",
        3,
      ),
    ).toEqual([]);
  });
});
