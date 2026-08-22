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
      { start: "2024-01-01T09:00:00Z", end: "2024-04-01T10:59:59.999999999Z" },
      { start: "2024-06-30T12:00:00.000000001Z", end: "2024-12-31T17:00:00Z" },
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
    // A=[1,10] B=[5,15] C=[8,20] (all at T00:00:00Z): [1,4]=1x, [5,7]=2x, [8,10]=3x, [11,15]=2x, [16,20]=1x
    expect(
      intervalXorAllUtc([
        { start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" },
        { start: "2024-01-05T00:00:00Z", end: "2024-01-15T00:00:00Z" },
        { start: "2024-01-08T00:00:00Z", end: "2024-01-20T00:00:00Z" },
      ]),
    ).toEqual([
      { start: "2024-01-01T00:00:00Z", end: "2024-01-04T23:59:59.999999999Z" },
      { start: "2024-01-08T00:00:00Z", end: "2024-01-10T00:00:00Z" },
      { start: "2024-01-15T00:00:00.000000001Z", end: "2024-01-20T00:00:00Z" },
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
      { start: "2024-01-01T00:00:00Z", end: "2024-01-04T23:59:59.999999999Z" },
      { start: "2024-01-08T00:00:00Z", end: "2024-01-10T00:00:00Z" },
      { start: "2024-01-15T00:00:00.000000001Z", end: "2024-01-20T00:00:00Z" },
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
});
