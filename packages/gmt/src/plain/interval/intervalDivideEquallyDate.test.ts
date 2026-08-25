import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { intervalDivideEquallyDate } from "./intervalDivideEquallyDate";

describe("intervalDivideEquallyDate", () => {
  it.each`
    start           | end             | n    | expected
    ${"2024-01-01"} | ${"2024-01-05"} | ${4} | ${[{ start: "2024-01-01", end: "2024-01-02" }, { start: "2024-01-02", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-04" }, { start: "2024-01-04", end: "2024-01-05" }]}
    ${"2024-01-01"} | ${"2024-01-10"} | ${1} | ${[{ start: "2024-01-01", end: "2024-01-10" }]}
    ${"2024-01-01"} | ${"2024-01-10"} | ${4} | ${[{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-06" }, { start: "2024-01-06", end: "2024-01-08" }, { start: "2024-01-08", end: "2024-01-10" }]}
    ${"2024-01-01"} | ${"2024-01-01"} | ${3} | ${[{ start: "2024-01-01", end: "2024-01-01" }, { start: "2024-01-01", end: "2024-01-01" }, { start: "2024-01-01", end: "2024-01-01" }]}
  `(
    "splits $start..$end into $n parts as $expected",
    ({ start, end, n, expected }) => {
      expect(intervalDivideEquallyDate(start, end, n)).toEqual(expected);
    },
  );

  // 9 days does not divide evenly by 4: PlainDate has no fractional-day representation, so
  // rounding produces a 2/3/2/2-day split rather than four exact 2.25-day pieces. Verified
  // against real @js-temporal/polyfill: Math.round(9*1/4)=2, Math.round(9*2/4)=5, Math.round(9*3/4)=7.
  it("rounds boundaries to the nearest whole day when n does not divide the total evenly", () => {
    expect(intervalDivideEquallyDate("2024-01-01", "2024-01-10", 4)).toEqual([
      { start: "2024-01-01", end: "2024-01-03" },
      { start: "2024-01-03", end: "2024-01-06" },
      { start: "2024-01-06", end: "2024-01-08" },
      { start: "2024-01-08", end: "2024-01-10" },
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
    expect(intervalDivideEquallyDate("2024-01-01", "2024-01-10", n)).toEqual(
      [],
    );
  });

  it.each`
    start           | end             | n
    ${"invalid"}    | ${"2024-01-10"} | ${3}
    ${"2024-01-10"} | ${"2024-01-01"} | ${3}
  `("returns [] for invalid $start, $end", ({ start, end, n }) => {
    expect(intervalDivideEquallyDate(start, end, n)).toEqual([]);
  });

  it("returns [] when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(intervalDivideEquallyDate("2024-01-01", "2024-01-10", 3)).toEqual(
      [],
    );
  });
  // E5 (issue #78): start and end must share the same calendar tag (or both be bare ISO)
  // (D4). Golden verified directly against @js-temporal/polyfill.
  it("divides in the shared calendar when start and end carry the same tag", () => {
    expect(
      intervalDivideEquallyDate("5784-01-01[u-ca=hebrew]", "5784-01-11[u-ca=hebrew]", 2),
    ).toEqual([
      { start: "5784-01-01[u-ca=hebrew]", end: "5784-01-06[u-ca=hebrew]" },
      { start: "5784-01-06[u-ca=hebrew]", end: "5784-01-11[u-ca=hebrew]" },
    ]);
  });

  it("returns [] when start and end carry mismatched calendar tags", () => {
    expect(
      intervalDivideEquallyDate("5784-01-01[u-ca=hebrew]", "2024-01-11", 2),
    ).toEqual([]);
  });
});
