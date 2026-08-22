import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { intervalSplitAtDate } from "./intervalSplitAtDate";

describe("intervalSplitAtDate", () => {
  it("splits at a single in-range point", () => {
    expect(
      intervalSplitAtDate("2024-01-01", "2024-01-10", ["2024-01-05"]),
    ).toEqual([
      { start: "2024-01-01", end: "2024-01-05" },
      { start: "2024-01-05", end: "2024-01-10" },
    ]);
  });

  it("sorts unsorted points before splitting", () => {
    expect(
      intervalSplitAtDate("2024-01-01", "2024-01-10", [
        "2024-01-07",
        "2024-01-03",
      ]),
    ).toEqual([
      { start: "2024-01-01", end: "2024-01-03" },
      { start: "2024-01-03", end: "2024-01-07" },
      { start: "2024-01-07", end: "2024-01-10" },
    ]);
  });

  it("drops points outside the interval", () => {
    expect(
      intervalSplitAtDate("2024-01-01", "2024-01-10", ["2024-06-01"]),
    ).toEqual([{ start: "2024-01-01", end: "2024-01-10" }]);
  });

  it("drops points exactly on the boundaries", () => {
    expect(
      intervalSplitAtDate("2024-01-01", "2024-01-10", [
        "2024-01-01",
        "2024-01-10",
      ]),
    ).toEqual([{ start: "2024-01-01", end: "2024-01-10" }]);
  });

  it("collapses duplicate points to a single boundary", () => {
    expect(
      intervalSplitAtDate("2024-01-01", "2024-01-10", [
        "2024-01-05",
        "2024-01-05",
      ]),
    ).toEqual([
      { start: "2024-01-01", end: "2024-01-05" },
      { start: "2024-01-05", end: "2024-01-10" },
    ]);
  });

  it("sorts, dedupes, and drops out-of-range/boundary points all in one call", () => {
    expect(
      intervalSplitAtDate("2024-01-01", "2024-01-10", [
        "2024-01-07",
        "2024-01-01",
        "2024-01-03",
        "2024-01-07",
        "2024-06-01",
        "2024-01-10",
      ]),
    ).toEqual([
      { start: "2024-01-01", end: "2024-01-03" },
      { start: "2024-01-03", end: "2024-01-07" },
      { start: "2024-01-07", end: "2024-01-10" },
    ]);
  });

  it("returns the whole interval unsplit for an empty points array", () => {
    expect(intervalSplitAtDate("2024-01-01", "2024-01-10", [])).toEqual([
      { start: "2024-01-01", end: "2024-01-10" },
    ]);
  });

  it.each`
    start           | end             | points
    ${"invalid"}    | ${"2024-01-10"} | ${["2024-01-05"]}
    ${"2024-01-10"} | ${"2024-01-01"} | ${["2024-01-05"]}
  `("returns [] for invalid $start, $end", ({ start, end, points }) => {
    expect(intervalSplitAtDate(start, end, points)).toEqual([]);
  });

  it.each`
    points
    ${"not-an-array"}
    ${["not-a-date"]}
    ${[123]}
    ${[null]}
  `("returns [] for invalid points $points", ({ points }) => {
    expect(intervalSplitAtDate("2024-01-01", "2024-01-10", points)).toEqual([]);
  });

  it("returns [] when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      intervalSplitAtDate("2024-01-01", "2024-01-10", ["2024-01-05"]),
    ).toEqual([]);
  });
});
