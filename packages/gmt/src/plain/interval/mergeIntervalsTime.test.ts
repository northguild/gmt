import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { mergeIntervalsTime } from "./mergeIntervalsTime";

describe("mergeIntervalsTime", () => {
  it.each`
    aStart        | aEnd          | bStart        | bEnd          | expected
    ${"09:00:00"} | ${"12:00:00"} | ${"11:00:00"} | ${"15:00:00"} | ${[{ start: "09:00:00", end: "15:00:00" }]}
    ${"09:00:00"} | ${"12:00:00"} | ${"12:00:00"} | ${"15:00:00"} | ${[{ start: "09:00:00", end: "15:00:00" }]}
    ${"09:00:00"} | ${"10:00:00"} | ${"12:00:00"} | ${"13:00:00"} | ${[{ start: "09:00:00", end: "10:00:00" }, { start: "12:00:00", end: "13:00:00" }]}
    ${"09:00:00"} | ${"09:59:59"} | ${"10:00:00"} | ${"11:00:00"} | ${[{ start: "09:00:00", end: "09:59:59" }, { start: "10:00:00", end: "11:00:00" }]}
    ${"09:00:00"} | ${"18:00:00"} | ${"11:00:00"} | ${"13:00:00"} | ${[{ start: "09:00:00", end: "18:00:00" }]}
    ${"12:00:00"} | ${"15:00:00"} | ${"09:00:00"} | ${"10:00:00"} | ${[{ start: "09:00:00", end: "10:00:00" }, { start: "12:00:00", end: "15:00:00" }]}
  `(
    "merges [$aStart,$aEnd] and [$bStart,$bEnd] into $expected",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(
        mergeIntervalsTime([
          { start: aStart, end: aEnd },
          { start: bStart, end: bEnd },
        ]),
      ).toEqual(expected);
    },
  );

  it("returns [] for an empty list", () => {
    expect(mergeIntervalsTime([])).toEqual([]);
  });

  it.each`
    intervals
    ${"not-an-array"}
    ${[{ start: "15:00:00", end: "09:00:00" }]}
    ${[{ start: "invalid", end: "09:00:00" }]}
    ${[{ start: "09:00:00", end: "12:00:00" }, "not-an-object"]}
  `("returns [] for invalid intervals $intervals", ({ intervals }) => {
    expect(mergeIntervalsTime(intervals)).toEqual([]);
  });

  it("returns [] when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(
      mergeIntervalsTime([{ start: "09:00:00", end: "12:00:00" }]),
    ).toEqual([]);
  });
});
