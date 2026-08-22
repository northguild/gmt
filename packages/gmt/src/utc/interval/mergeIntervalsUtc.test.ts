import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { mergeIntervalsUtc } from "./mergeIntervalsUtc";

describe("mergeIntervalsUtc", () => {
  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-10T00:00:00Z"} | ${"2024-01-05T00:00:00Z"} | ${"2024-01-15T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-15T00:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-10T00:00:00Z"} | ${"2024-01-10T00:00:00Z"} | ${"2024-01-20T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-20T00:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-05T00:00:00Z"} | ${"2024-01-10T00:00:00Z"} | ${"2024-01-15T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" }, { start: "2024-01-10T00:00:00Z", end: "2024-01-15T00:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-05T23:59:59Z"} | ${"2024-01-06T00:00:00Z"} | ${"2024-01-10T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-05T23:59:59Z" }, { start: "2024-01-06T00:00:00Z", end: "2024-01-10T00:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-20T00:00:00Z"} | ${"2024-01-05T00:00:00Z"} | ${"2024-01-10T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-20T00:00:00Z" }]}
    ${"2024-01-10T00:00:00Z"} | ${"2024-01-20T00:00:00Z"} | ${"2024-01-01T00:00:00Z"} | ${"2024-01-05T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" }, { start: "2024-01-10T00:00:00Z", end: "2024-01-20T00:00:00Z" }]}
  `(
    "merges [$aStart,$aEnd] and [$bStart,$bEnd] into $expected",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(
        mergeIntervalsUtc([
          { start: aStart, end: aEnd },
          { start: bStart, end: bEnd },
        ]),
      ).toEqual(expected);
    },
  );

  it("returns [] for an empty list", () => {
    expect(mergeIntervalsUtc([])).toEqual([]);
  });

  it.each`
    intervals
    ${"not-an-array"}
    ${[{ start: "2024-01-10T00:00:00Z", end: "2024-01-01T00:00:00Z" }]}
    ${[{ start: "invalid", end: "2024-01-01T00:00:00Z" }]}
    ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" }, "not-an-object"]}
    ${[{ start: "2024-06-30T23:59:60Z", end: "2024-07-01T00:00:00Z" }]}
    ${[{ start: "2024-01-01T00:00:00Z", end: "2024-06-30T23:59:60Z" }]}
  `("returns [] for invalid intervals $intervals", ({ intervals }) => {
    expect(mergeIntervalsUtc(intervals)).toEqual([]);
  });

  it("returns [] when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      mergeIntervalsUtc([
        { start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" },
      ]),
    ).toEqual([]);
  });
});
