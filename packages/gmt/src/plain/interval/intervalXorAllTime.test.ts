import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { intervalXorAllTime } from "./intervalXorAllTime";
import { intervalXorTime } from "./intervalXorTime";

describe("intervalXorAllTime", () => {
  it("reduces to the pairwise result for two overlapping intervals", () => {
    const a = { start: "09:00:00", end: "12:00:00" };
    const b = { start: "11:00:00", end: "15:00:00" };

    const result = intervalXorAllTime([a, b]);

    expect(result).toEqual(intervalXorTime(a.start, a.end, b.start, b.end));
    expect(result).toEqual([
      { start: "09:00:00", end: "10:59:59.999999999" },
      { start: "12:00:00.000000001", end: "15:00:00" },
    ]);
  });

  it("returns both intervals unchanged for two disjoint intervals", () => {
    expect(
      intervalXorAllTime([
        { start: "06:00:00", end: "08:00:00" },
        { start: "20:00:00", end: "22:00:00" },
      ]),
    ).toEqual([
      { start: "06:00:00", end: "08:00:00" },
      { start: "20:00:00", end: "22:00:00" },
    ]);
  });

  it("returns [] when two identical intervals cancel out", () => {
    expect(
      intervalXorAllTime([
        { start: "09:00:00", end: "12:00:00" },
        { start: "09:00:00", end: "12:00:00" },
      ]),
    ).toEqual([]);
  });

  it("returns the single interval unchanged for a one-element list", () => {
    expect(
      intervalXorAllTime([{ start: "09:00:00", end: "12:00:00" }]),
    ).toEqual([{ start: "09:00:00", end: "12:00:00" }]);
  });

  it("returns [] for an empty list", () => {
    expect(intervalXorAllTime([])).toEqual([]);
  });

  it("handles a 3-way overlap, keeping only oddly-covered regions (odd-vs-even sweep)", () => {
    // A=[06,18] B=[10,20] C=[14,22]: [06,10)=1x, [10,14)=2x, [14,18)=3x, [18,20)=2x, [20,22]=1x
    expect(
      intervalXorAllTime([
        { start: "06:00:00", end: "18:00:00" },
        { start: "10:00:00", end: "20:00:00" },
        { start: "14:00:00", end: "22:00:00" },
      ]),
    ).toEqual([
      { start: "06:00:00", end: "09:59:59.999999999" },
      { start: "14:00:00", end: "18:00:00" },
      { start: "20:00:00.000000001", end: "22:00:00" },
    ]);
  });

  it("does not depend on input order for a 3-way overlap", () => {
    expect(
      intervalXorAllTime([
        { start: "14:00:00", end: "22:00:00" },
        { start: "06:00:00", end: "18:00:00" },
        { start: "10:00:00", end: "20:00:00" },
      ]),
    ).toEqual([
      { start: "06:00:00", end: "09:59:59.999999999" },
      { start: "14:00:00", end: "18:00:00" },
      { start: "20:00:00.000000001", end: "22:00:00" },
    ]);
  });

  it.each`
    intervals
    ${"not-an-array"}
    ${[{ start: "15:00:00", end: "09:00:00" }]}
    ${[{ start: "invalid", end: "09:00:00" }]}
    ${[{ start: "09:00:00", end: "12:00:00" }, "not-an-object"]}
  `("returns [] for invalid intervals $intervals", ({ intervals }) => {
    expect(intervalXorAllTime(intervals)).toEqual([]);
  });

  it("returns [] when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(
      intervalXorAllTime([{ start: "09:00:00", end: "12:00:00" }]),
    ).toEqual([]);
  });

  // PlainTime has no day rollover, so an interval may end on the last nanosecond of the day and no
  // boundary may be computed as `end + 1 ns` (it would wrap to 00:00:00). Each expected value is the
  // set of times covered an odd number of times: 23:00 - 1 ns = 22:59:59.999999999 and
  // 23:30 + 1 ns = 23:30:00.000000001.
  it.each`
    intervals                                                                                               | expected
    ${[{ start: "22:00:00", end: "23:59:59.999999999" }]}                                                   | ${[{ start: "22:00:00", end: "23:59:59.999999999" }]}
    ${[{ start: "00:00:00", end: "23:59:59.999999999" }]}                                                   | ${[{ start: "00:00:00", end: "23:59:59.999999999" }]}
    ${[{ start: "22:00:00", end: "23:59:59.999999999" }, { start: "23:00:00", end: "23:30:00" }]}           | ${[{ start: "22:00:00", end: "22:59:59.999999999" }, { start: "23:30:00.000000001", end: "23:59:59.999999999" }]}
    ${[{ start: "22:00:00", end: "23:59:59.999999999" }, { start: "23:00:00", end: "23:59:59.999999999" }]} | ${[{ start: "22:00:00", end: "22:59:59.999999999" }]}
  `(
    "returns $expected for $intervals at the end of the day (no midnight wrap)",
    ({ intervals, expected }) => {
      expect(intervalXorAllTime(intervals)).toEqual(expected);
    },
  );

  it("returns one maximal run when a run starts one nanosecond after the previous run ends", () => {
    // 09:00..12:00 and 12:00:00.000000001..15:00 are each covered once with no gap between them.
    expect(
      intervalXorAllTime([
        { start: "09:00:00", end: "12:00:00" },
        { start: "12:00:00.000000001", end: "15:00:00" },
      ]),
    ).toEqual([{ start: "09:00:00", end: "15:00:00" }]);
  });
});
