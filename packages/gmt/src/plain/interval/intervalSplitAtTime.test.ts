import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { intervalSplitAtTime } from "./intervalSplitAtTime";

describe("intervalSplitAtTime", () => {
  it("splits at a single in-range point", () => {
    expect(intervalSplitAtTime("09:00:00", "17:00:00", ["12:00:00"])).toEqual([
      { start: "09:00:00", end: "12:00:00" },
      { start: "12:00:00", end: "17:00:00" },
    ]);
  });

  it("sorts unsorted points before splitting", () => {
    expect(
      intervalSplitAtTime("09:00:00", "17:00:00", ["15:00:00", "11:00:00"]),
    ).toEqual([
      { start: "09:00:00", end: "11:00:00" },
      { start: "11:00:00", end: "15:00:00" },
      { start: "15:00:00", end: "17:00:00" },
    ]);
  });

  it("drops points outside the interval and on the boundaries", () => {
    expect(
      intervalSplitAtTime("09:00:00", "17:00:00", [
        "09:00:00",
        "17:00:00",
        "20:00:00",
      ]),
    ).toEqual([{ start: "09:00:00", end: "17:00:00" }]);
  });

  it("collapses duplicate points to a single boundary", () => {
    expect(
      intervalSplitAtTime("09:00:00", "17:00:00", ["12:00:00", "12:00:00"]),
    ).toEqual([
      { start: "09:00:00", end: "12:00:00" },
      { start: "12:00:00", end: "17:00:00" },
    ]);
  });

  it("returns the whole interval unsplit for an empty points array", () => {
    expect(intervalSplitAtTime("09:00:00", "17:00:00", [])).toEqual([
      { start: "09:00:00", end: "17:00:00" },
    ]);
  });

  it.each`
    start         | end           | points
    ${"invalid"}  | ${"17:00:00"} | ${["12:00:00"]}
    ${"17:00:00"} | ${"09:00:00"} | ${["12:00:00"]}
  `("returns [] for invalid $start, $end", ({ start, end, points }) => {
    expect(intervalSplitAtTime(start, end, points)).toEqual([]);
  });

  it.each`
    points
    ${"not-an-array"}
    ${["not-a-time"]}
  `("returns [] for invalid points $points", ({ points }) => {
    expect(intervalSplitAtTime("09:00:00", "17:00:00", points)).toEqual([]);
  });

  it("returns [] when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(intervalSplitAtTime("09:00:00", "17:00:00", ["12:00:00"])).toEqual(
      [],
    );
  });
});
