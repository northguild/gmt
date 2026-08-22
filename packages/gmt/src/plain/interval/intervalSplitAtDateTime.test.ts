import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { intervalSplitAtDateTime } from "./intervalSplitAtDateTime";

describe("intervalSplitAtDateTime", () => {
  it("splits at a single in-range point", () => {
    expect(
      intervalSplitAtDateTime("2024-01-01T00:00:00", "2024-01-10T00:00:00", [
        "2024-01-05T00:00:00",
      ]),
    ).toEqual([
      { start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" },
      { start: "2024-01-05T00:00:00", end: "2024-01-10T00:00:00" },
    ]);
  });

  it("sorts unsorted points before splitting into 3+ segments", () => {
    expect(
      intervalSplitAtDateTime("2024-01-01T00:00:00", "2024-01-10T00:00:00", [
        "2024-01-07T00:00:00",
        "2024-01-03T00:00:00",
      ]),
    ).toEqual([
      { start: "2024-01-01T00:00:00", end: "2024-01-03T00:00:00" },
      { start: "2024-01-03T00:00:00", end: "2024-01-07T00:00:00" },
      { start: "2024-01-07T00:00:00", end: "2024-01-10T00:00:00" },
    ]);
  });

  it("drops points outside the interval", () => {
    expect(
      intervalSplitAtDateTime("2024-01-01T00:00:00", "2024-01-10T00:00:00", [
        "2024-06-01T00:00:00",
      ]),
    ).toEqual([{ start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" }]);
  });

  it("drops points exactly on the boundaries", () => {
    expect(
      intervalSplitAtDateTime("2024-01-01T00:00:00", "2024-01-10T00:00:00", [
        "2024-01-01T00:00:00",
        "2024-01-10T00:00:00",
      ]),
    ).toEqual([{ start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" }]);
  });

  it("collapses duplicate points to a single boundary", () => {
    expect(
      intervalSplitAtDateTime("2024-01-01T00:00:00", "2024-01-10T00:00:00", [
        "2024-01-05T00:00:00",
        "2024-01-05T00:00:00",
      ]),
    ).toEqual([
      { start: "2024-01-01T00:00:00", end: "2024-01-05T00:00:00" },
      { start: "2024-01-05T00:00:00", end: "2024-01-10T00:00:00" },
    ]);
  });

  it("returns the whole interval unsplit for an empty points array", () => {
    expect(
      intervalSplitAtDateTime("2024-01-01T00:00:00", "2024-01-10T00:00:00", []),
    ).toEqual([{ start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" }]);
  });

  it.each`
    start                    | end
    ${"invalid"}             | ${"2024-01-10T00:00:00"}
    ${"2024-01-10T00:00:00"} | ${"2024-01-01T00:00:00"}
  `("returns [] for invalid $start, $end", ({ start, end }) => {
    expect(
      intervalSplitAtDateTime(start, end, ["2024-01-05T00:00:00"]),
    ).toEqual([]);
  });

  it.each`
    points
    ${"not-an-array"}
    ${["not-a-datetime"]}
    ${["2024-01-05"]}
    ${[123]}
    ${[null]}
  `("returns [] for invalid points $points", ({ points }) => {
    expect(
      intervalSplitAtDateTime(
        "2024-01-01T00:00:00",
        "2024-01-10T00:00:00",
        points,
      ),
    ).toEqual([]);
  });

  it("returns [] when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      intervalSplitAtDateTime("2024-01-01T00:00:00", "2024-01-10T00:00:00", [
        "2024-01-05T00:00:00",
      ]),
    ).toEqual([]);
  });
});
