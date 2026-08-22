import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { intervalXorAllDate } from "./intervalXorAllDate";
import { intervalXorDate } from "./intervalXorDate";

describe("intervalXorAllDate", () => {
  it("reduces to the pairwise result for two overlapping intervals", () => {
    const a = { start: "2024-01-01", end: "2024-06-30" };
    const b = { start: "2024-04-01", end: "2024-12-31" };

    const result = intervalXorAllDate([a, b]);

    expect(result).toEqual(intervalXorDate(a.start, a.end, b.start, b.end));
    expect(result).toEqual([
      { start: "2024-01-01", end: "2024-03-31" },
      { start: "2024-07-01", end: "2024-12-31" },
    ]);
  });

  it("returns both intervals unchanged for two disjoint intervals", () => {
    expect(
      intervalXorAllDate([
        { start: "2024-01-01", end: "2024-01-05" },
        { start: "2024-01-10", end: "2024-01-15" },
      ]),
    ).toEqual([
      { start: "2024-01-01", end: "2024-01-05" },
      { start: "2024-01-10", end: "2024-01-15" },
    ]);
  });

  it("returns [] when two identical intervals cancel out", () => {
    expect(
      intervalXorAllDate([
        { start: "2024-01-01", end: "2024-01-05" },
        { start: "2024-01-01", end: "2024-01-05" },
      ]),
    ).toEqual([]);
  });

  it("returns the single interval unchanged for a one-element list", () => {
    expect(
      intervalXorAllDate([{ start: "2024-01-01", end: "2024-01-05" }]),
    ).toEqual([{ start: "2024-01-01", end: "2024-01-05" }]);
  });

  it("returns [] for an empty list", () => {
    expect(intervalXorAllDate([])).toEqual([]);
  });

  it("handles a 3-way overlap, keeping only oddly-covered regions (odd-vs-even sweep)", () => {
    // A=[1,10] B=[5,15] C=[8,20]: [1,4]=1x(odd), [5,7]=2x(even), [8,10]=3x(odd), [11,15]=2x(even), [16,20]=1x(odd)
    expect(
      intervalXorAllDate([
        { start: "2024-01-01", end: "2024-01-10" },
        { start: "2024-01-05", end: "2024-01-15" },
        { start: "2024-01-08", end: "2024-01-20" },
      ]),
    ).toEqual([
      { start: "2024-01-01", end: "2024-01-04" },
      { start: "2024-01-08", end: "2024-01-10" },
      { start: "2024-01-16", end: "2024-01-20" },
    ]);
  });

  it("does not depend on input order for a 3-way overlap", () => {
    expect(
      intervalXorAllDate([
        { start: "2024-01-08", end: "2024-01-20" },
        { start: "2024-01-01", end: "2024-01-10" },
        { start: "2024-01-05", end: "2024-01-15" },
      ]),
    ).toEqual([
      { start: "2024-01-01", end: "2024-01-04" },
      { start: "2024-01-08", end: "2024-01-10" },
      { start: "2024-01-16", end: "2024-01-20" },
    ]);
  });

  it.each`
    intervals
    ${"not-an-array"}
    ${[{ start: "2024-01-10", end: "2024-01-01" }]}
    ${[{ start: "invalid", end: "2024-01-01" }]}
    ${[{ start: "2024-01-01", end: "2024-01-10" }, "not-an-object"]}
  `("returns [] for invalid intervals $intervals", ({ intervals }) => {
    expect(intervalXorAllDate(intervals)).toEqual([]);
  });

  it("returns [] when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      intervalXorAllDate([{ start: "2024-01-01", end: "2024-01-10" }]),
    ).toEqual([]);
  });
});
