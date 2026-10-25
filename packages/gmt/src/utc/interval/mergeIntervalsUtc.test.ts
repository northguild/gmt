import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { mergeIntervalsUtc } from "./mergeIntervalsUtc";

describe("mergeIntervalsUtc", () => {
  // Half-open: touching joins (CORE-6 §1.2 coalesce); a stranded empty interval is dropped.
  it.each`
    aStart                        | aEnd                      | bStart                              | bEnd                      | expected
    ${"2024-01-01T00:00:00Z"}     | ${"2024-01-10T00:00:00Z"} | ${"2024-01-05T00:00:00Z"}           | ${"2024-01-15T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-15T00:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"}     | ${"2024-01-10T00:00:00Z"} | ${"2024-01-10T00:00:00Z"}           | ${"2024-01-20T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-20T00:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"}     | ${"2024-01-05T00:00:00Z"} | ${"2024-01-10T00:00:00Z"}           | ${"2024-01-15T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" }, { start: "2024-01-10T00:00:00Z", end: "2024-01-15T00:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"}     | ${"2024-01-05T23:59:59Z"} | ${"2024-01-06T00:00:00Z"}           | ${"2024-01-10T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-05T23:59:59Z" }, { start: "2024-01-06T00:00:00Z", end: "2024-01-10T00:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"}     | ${"2024-01-20T00:00:00Z"} | ${"2024-01-05T00:00:00Z"}           | ${"2024-01-10T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-20T00:00:00Z" }]}
    ${"2024-01-10T00:00:00Z"}     | ${"2024-01-20T00:00:00Z"} | ${"2024-01-01T00:00:00Z"}           | ${"2024-01-05T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" }, { start: "2024-01-10T00:00:00Z", end: "2024-01-20T00:00:00Z" }]}
    ${"2024-01-01T09:00:00Z"}     | ${"2024-01-01T12:00:00Z"} | ${"2024-01-01T12:00:00.000000001Z"} | ${"2024-01-01T17:00:00Z"} | ${[{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T12:00:00.000000001Z", end: "2024-01-01T17:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"}     | ${"2024-01-01T00:00:00Z"} | ${"2024-01-05T00:00:00Z"}           | ${"2024-01-10T00:00:00Z"} | ${[{ start: "2024-01-05T00:00:00Z", end: "2024-01-10T00:00:00Z" }]}
    ${"2024-01-01T00:00:00Z"}     | ${"2024-01-10T00:00:00Z"} | ${"2024-01-10T00:00:00Z"}           | ${"2024-01-10T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" }]}
    ${"2024-01-05T00:00:00Z"}     | ${"2024-01-05T00:00:00Z"} | ${"2024-01-05T00:00:00Z"}           | ${"2024-01-05T00:00:00Z"} | ${[]}
    ${"2024-01-01T00:00:00.000Z"} | ${"2024-01-10T00:00Z"}    | ${"2024-01-05T00:00:00Z"}           | ${"2024-01-15T00:00:00Z"} | ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-15T00:00:00Z" }]}
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
    intervals                                                                            | why
    ${"not-an-array"}                                                                    | ${"a string, not an array"}
    ${[{ start: "2024-01-10T00:00:00Z", end: "2024-01-01T00:00:00Z" }]}                  | ${"an end before the start"}
    ${[{ start: "invalid", end: "2024-01-01T00:00:00Z" }]}                               | ${"an unparsable start"}
    ${[{ start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" }, "not-an-object"]} | ${"an entry that is not an object"}
    ${[{ start: "2024-06-30T23:59:60Z", end: "2024-07-01T00:00:00Z" }]}                  | ${"a start at second :60"}
    ${[{ start: "2024-01-01T00:00:00Z", end: "2024-06-30T23:59:60Z" }]}                  | ${"an end at second :60"}
  `("returns [] for invalid intervals: $why", ({ intervals }) => {
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
