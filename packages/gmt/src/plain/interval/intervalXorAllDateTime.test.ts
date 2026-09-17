import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { intervalXorAllDateTime } from "./intervalXorAllDateTime";
import { intervalXorDateTime } from "./intervalXorDateTime";

describe("intervalXorAllDateTime", () => {
  it("reduces to the pairwise result for two overlapping intervals", () => {
    const a = { start: "2024-01-01T09:00:00", end: "2024-06-30T12:00:00" };
    const b = { start: "2024-04-01T11:00:00", end: "2024-12-31T17:00:00" };

    const result = intervalXorAllDateTime([a, b]);

    expect(result).toEqual(intervalXorDateTime(a.start, a.end, b.start, b.end));
    expect(result).toEqual([
      { start: "2024-01-01T09:00:00", end: "2024-04-01T11:00:00" },
      { start: "2024-06-30T12:00:00", end: "2024-12-31T17:00:00" },
    ]);
  });

  it("returns both intervals unchanged for two disjoint intervals", () => {
    expect(
      intervalXorAllDateTime([
        { start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" },
        { start: "2024-02-01T00:00:00", end: "2024-02-05T00:00:00" },
      ]),
    ).toEqual([
      { start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" },
      { start: "2024-02-01T00:00:00", end: "2024-02-05T00:00:00" },
    ]);
  });

  it("returns [] when two identical intervals cancel out", () => {
    expect(
      intervalXorAllDateTime([
        { start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" },
        { start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" },
      ]),
    ).toEqual([]);
  });

  it("returns the single interval unchanged for a one-element list", () => {
    expect(
      intervalXorAllDateTime([
        { start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" },
      ]),
    ).toEqual([{ start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" }]);
  });

  it("returns [] for an empty list", () => {
    expect(intervalXorAllDateTime([])).toEqual([]);
  });

  it("handles a 3-way overlap, keeping only oddly-covered regions (odd-vs-even sweep)", () => {
    // Half-open A=[1,10) B=[5,15) C=[8,20) (all at T00:00:00): [1,5)=1x, [5,8)=2x, [8,10)=3x, [10,15)=2x, [15,20)=1x
    expect(
      intervalXorAllDateTime([
        { start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" },
        { start: "2024-01-05T00:00:00", end: "2024-01-15T00:00:00" },
        { start: "2024-01-08T00:00:00", end: "2024-01-20T00:00:00" },
      ]),
    ).toEqual([
      { start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" },
      { start: "2024-01-08T00:00:00", end: "2024-01-10T00:00:00" },
      { start: "2024-01-15T00:00:00", end: "2024-01-20T00:00:00" },
    ]);
  });

  it("does not depend on input order for a 3-way overlap", () => {
    expect(
      intervalXorAllDateTime([
        { start: "2024-01-08T00:00:00", end: "2024-01-20T00:00:00" },
        { start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" },
        { start: "2024-01-05T00:00:00", end: "2024-01-15T00:00:00" },
      ]),
    ).toEqual([
      { start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" },
      { start: "2024-01-08T00:00:00", end: "2024-01-10T00:00:00" },
      { start: "2024-01-15T00:00:00", end: "2024-01-20T00:00:00" },
    ]);
  });

  it.each`
    intervals
    ${"not-an-array"}
    ${[{ start: "2024-01-10T00:00:00", end: "2024-01-01T00:00:00" }]}
    ${[{ start: "invalid", end: "2024-01-01T00:00:00" }]}
    ${[{ start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" }, "not-an-object"]}
  `("returns [] for invalid intervals $intervals", ({ intervals }) => {
    expect(intervalXorAllDateTime(intervals)).toEqual([]);
  });

  it("returns [] when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      intervalXorAllDateTime([
        { start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" },
      ]),
    ).toEqual([]);
  });

  // The last representable PlainDateTime is +275760-09-13T23:59:59.999999999, so no boundary may be
  // computed as `end + 1 ns`. Nested: [T06:00, T12:00) is covered twice, so the half-open odd runs
  // end exactly at T06:00 and resume exactly at T12:00.
  it.each`
    intervals                                                                                                                                             | expected
    ${[{ start: "+275760-09-13T00:00:00", end: "+275760-09-13T23:59:59.999999999" }]}                                                                     | ${[{ start: "+275760-09-13T00:00:00", end: "+275760-09-13T23:59:59.999999999" }]}
    ${[{ start: "+275760-09-13T00:00:00", end: "+275760-09-13T23:59:59.999999999" }, { start: "+275760-09-13T06:00:00", end: "+275760-09-13T12:00:00" }]} | ${[{ start: "+275760-09-13T00:00:00", end: "+275760-09-13T06:00:00" }, { start: "+275760-09-13T12:00:00", end: "+275760-09-13T23:59:59.999999999" }]}
  `(
    "returns $expected for $intervals (an end at the maximum PlainDateTime)",
    ({ intervals, expected }) => {
      expect(intervalXorAllDateTime(intervals)).toEqual(expected);
    },
  );
});
