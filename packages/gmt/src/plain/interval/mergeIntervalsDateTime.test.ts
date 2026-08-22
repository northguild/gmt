import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { mergeIntervalsDateTime } from "./mergeIntervalsDateTime";

describe("mergeIntervalsDateTime", () => {
  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-01-01T00:00:00"} | ${"2024-01-10T00:00:00"} | ${"2024-01-05T00:00:00"} | ${"2024-01-15T00:00:00"} | ${[{ start: "2024-01-01T00:00:00", end: "2024-01-15T00:00:00" }]}
    ${"2024-01-01T00:00:00"} | ${"2024-01-10T00:00:00"} | ${"2024-01-10T00:00:00"} | ${"2024-01-20T00:00:00"} | ${[{ start: "2024-01-01T00:00:00", end: "2024-01-20T00:00:00" }]}
    ${"2024-01-01T00:00:00"} | ${"2024-01-05T00:00:00"} | ${"2024-01-10T00:00:00"} | ${"2024-01-15T00:00:00"} | ${[{ start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" }, { start: "2024-01-10T00:00:00", end: "2024-01-15T00:00:00" }]}
    ${"2024-01-01T00:00:00"} | ${"2024-01-05T23:59:59"} | ${"2024-01-06T00:00:00"} | ${"2024-01-10T00:00:00"} | ${[{ start: "2024-01-01T00:00:00", end: "2024-01-05T23:59:59" }, { start: "2024-01-06T00:00:00", end: "2024-01-10T00:00:00" }]}
    ${"2024-01-01T00:00:00"} | ${"2024-01-20T00:00:00"} | ${"2024-01-05T00:00:00"} | ${"2024-01-10T00:00:00"} | ${[{ start: "2024-01-01T00:00:00", end: "2024-01-20T00:00:00" }]}
    ${"2024-01-10T00:00:00"} | ${"2024-01-20T00:00:00"} | ${"2024-01-01T00:00:00"} | ${"2024-01-05T00:00:00"} | ${[{ start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" }, { start: "2024-01-10T00:00:00", end: "2024-01-20T00:00:00" }]}
  `(
    "merges [$aStart,$aEnd] and [$bStart,$bEnd] into $expected",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(
        mergeIntervalsDateTime([
          { start: aStart, end: aEnd },
          { start: bStart, end: bEnd },
        ]),
      ).toEqual(expected);
    },
  );

  it("returns [] for an empty list", () => {
    expect(mergeIntervalsDateTime([])).toEqual([]);
  });

  it.each`
    intervals
    ${"not-an-array"}
    ${[{ start: "2024-01-10T00:00:00", end: "2024-01-01T00:00:00" }]}
    ${[{ start: "invalid", end: "2024-01-01T00:00:00" }]}
    ${[{ start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" }, "not-an-object"]}
  `("returns [] for invalid intervals $intervals", ({ intervals }) => {
    expect(mergeIntervalsDateTime(intervals)).toEqual([]);
  });

  it("returns [] when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      mergeIntervalsDateTime([
        { start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" },
      ]),
    ).toEqual([]);
  });
});
