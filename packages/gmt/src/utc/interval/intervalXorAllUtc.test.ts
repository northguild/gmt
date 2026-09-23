import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { intervalXorAllUtc } from "./intervalXorAllUtc";
import { intervalXorUtc } from "./intervalXorUtc";

describe("intervalXorAllUtc", () => {
  it("reduces to the pairwise result for two overlapping intervals", () => {
    const a = { start: "2024-01-01T09:00:00Z", end: "2024-06-30T12:00:00Z" };
    const b = { start: "2024-04-01T11:00:00Z", end: "2024-12-31T17:00:00Z" };

    const result = intervalXorAllUtc([a, b]);

    expect(result).toEqual(intervalXorUtc(a.start, a.end, b.start, b.end));
    expect(result).toEqual([
      { start: "2024-01-01T09:00:00Z", end: "2024-04-01T11:00:00Z" },
      { start: "2024-06-30T12:00:00Z", end: "2024-12-31T17:00:00Z" },
    ]);
  });

  it("returns both intervals unchanged for two disjoint intervals", () => {
    expect(
      intervalXorAllUtc([
        { start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" },
        { start: "2024-02-01T00:00:00Z", end: "2024-02-05T00:00:00Z" },
      ]),
    ).toEqual([
      { start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" },
      { start: "2024-02-01T00:00:00Z", end: "2024-02-05T00:00:00Z" },
    ]);
  });

  it("returns [] when two identical intervals cancel out", () => {
    expect(
      intervalXorAllUtc([
        { start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" },
        { start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" },
      ]),
    ).toEqual([]);
  });

  it("returns the single interval unchanged for a one-element list", () => {
    expect(
      intervalXorAllUtc([
        { start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" },
      ]),
    ).toEqual([{ start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" }]);
  });

  it("returns [] for an empty list", () => {
    expect(intervalXorAllUtc([])).toEqual([]);
  });

  it("handles a 3-way overlap, keeping only oddly-covered regions (odd-vs-even sweep)", () => {
    // Half-open A=[1,10) B=[5,15) C=[8,20) (all at T00:00:00Z): [1,5)=1x, [5,8)=2x, [8,10)=3x, [10,15)=2x, [15,20)=1x
    expect(
      intervalXorAllUtc([
        { start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" },
        { start: "2024-01-05T00:00:00Z", end: "2024-01-15T00:00:00Z" },
        { start: "2024-01-08T00:00:00Z", end: "2024-01-20T00:00:00Z" },
      ]),
    ).toEqual([
      { start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" },
      { start: "2024-01-08T00:00:00Z", end: "2024-01-10T00:00:00Z" },
      { start: "2024-01-15T00:00:00Z", end: "2024-01-20T00:00:00Z" },
    ]);
  });

  it("does not depend on input order for a 3-way overlap", () => {
    expect(
      intervalXorAllUtc([
        { start: "2024-01-08T00:00:00Z", end: "2024-01-20T00:00:00Z" },
        { start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" },
        { start: "2024-01-05T00:00:00Z", end: "2024-01-15T00:00:00Z" },
      ]),
    ).toEqual([
      { start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" },
      { start: "2024-01-08T00:00:00Z", end: "2024-01-10T00:00:00Z" },
      { start: "2024-01-15T00:00:00Z", end: "2024-01-20T00:00:00Z" },
    ]);
  });

  it.each`
    intervals
    ${"not-an-array"}
    ${[{ start: "2024-01-10T00:00:00Z", end: "2024-01-01T00:00:00Z" }]}
    ${[{ start: "invalid", end: "2024-01-01T00:00:00Z" }]}
    ${[{ start: "2023-12-31T23:59:60Z", end: "2024-01-01T00:00:00Z" }]}
    ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" }, "not-an-object"]}
  `("returns [] for invalid intervals $intervals", ({ intervals }) => {
    expect(intervalXorAllUtc(intervals)).toEqual([]);
  });

  it("returns [] when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      intervalXorAllUtc([
        { start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" },
      ]),
    ).toEqual([]);
  });

  // The last representable Instant is +275760-09-13T00:00:00Z, so no boundary may be computed as
  // `end + 1 ns`. Nested: [06:00Z, 12:00Z) on 09-12 is covered twice, so the half-open odd
  // runs end exactly at 06:00Z and resume exactly at 12:00Z.
  it.each`
    intervals                                                                                                                                       | expected
    ${[{ start: "+275760-09-12T00:00:00Z", end: "+275760-09-13T00:00:00Z" }]}                                                                       | ${[{ start: "+275760-09-12T00:00:00Z", end: "+275760-09-13T00:00:00Z" }]}
    ${[{ start: "+275760-09-12T00:00:00Z", end: "+275760-09-13T00:00:00Z" }, { start: "+275760-09-12T06:00:00Z", end: "+275760-09-12T12:00:00Z" }]} | ${[{ start: "+275760-09-12T00:00:00Z", end: "+275760-09-12T06:00:00Z" }, { start: "+275760-09-12T12:00:00Z", end: "+275760-09-13T00:00:00Z" }]}
  `(
    "returns $expected for $intervals (an end at the maximum Instant)",
    ({ intervals, expected }) => {
      expect(intervalXorAllUtc(intervals)).toEqual(expected);
    },
  );
});
