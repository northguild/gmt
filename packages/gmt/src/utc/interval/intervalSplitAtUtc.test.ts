import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { intervalSplitAtUtc } from "./intervalSplitAtUtc";

describe("intervalSplitAtUtc", () => {
  it("splits at a single in-range point", () => {
    expect(
      intervalSplitAtUtc("2024-01-01T00:00:00Z", "2024-01-10T00:00:00Z", [
        "2024-01-05T00:00:00Z",
      ]),
    ).toEqual([
      { start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" },
      { start: "2024-01-05T00:00:00Z", end: "2024-01-10T00:00:00Z" },
    ]);
  });

  it("sorts unsorted points before splitting into 3+ segments", () => {
    expect(
      intervalSplitAtUtc("2024-01-01T00:00:00Z", "2024-01-10T00:00:00Z", [
        "2024-01-07T00:00:00Z",
        "2024-01-03T00:00:00Z",
      ]),
    ).toEqual([
      { start: "2024-01-01T00:00:00Z", end: "2024-01-03T00:00:00Z" },
      { start: "2024-01-03T00:00:00Z", end: "2024-01-07T00:00:00Z" },
      { start: "2024-01-07T00:00:00Z", end: "2024-01-10T00:00:00Z" },
    ]);
  });

  it("drops points outside the interval", () => {
    expect(
      intervalSplitAtUtc("2024-01-01T00:00:00Z", "2024-01-10T00:00:00Z", [
        "2024-06-01T00:00:00Z",
      ]),
    ).toEqual([{ start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" }]);
  });

  it("drops points exactly on the boundaries", () => {
    expect(
      intervalSplitAtUtc("2024-01-01T00:00:00Z", "2024-01-10T00:00:00Z", [
        "2024-01-01T00:00:00Z",
        "2024-01-10T00:00:00Z",
      ]),
    ).toEqual([{ start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" }]);
  });

  it("collapses duplicate points to a single boundary", () => {
    expect(
      intervalSplitAtUtc("2024-01-01T00:00:00Z", "2024-01-10T00:00:00Z", [
        "2024-01-05T00:00:00Z",
        "2024-01-05T00:00:00Z",
      ]),
    ).toEqual([
      { start: "2024-01-01T00:00:00Z", end: "2024-01-05T00:00:00Z" },
      { start: "2024-01-05T00:00:00Z", end: "2024-01-10T00:00:00Z" },
    ]);
  });

  it("returns the whole interval unsplit for an empty points array", () => {
    expect(
      intervalSplitAtUtc("2024-01-01T00:00:00Z", "2024-01-10T00:00:00Z", []),
    ).toEqual([{ start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" }]);
  });

  it.each`
    start                     | end
    ${"invalid"}              | ${"2024-01-10T00:00:00Z"}
    ${"2024-01-10T00:00:00Z"} | ${"2024-01-01T00:00:00Z"}
    ${"2024-12-31T23:59:60Z"} | ${"2024-01-10T00:00:00Z"}
  `("returns [] for invalid $start, $end", ({ start, end }) => {
    expect(intervalSplitAtUtc(start, end, ["2024-01-05T00:00:00Z"])).toEqual(
      [],
    );
  });

  it.each`
    points
    ${"not-an-array"}
    ${["not-a-datetime"]}
    ${["2024-01-05T00:00:00"]}
    ${["2024-06-30T23:59:60Z"]}
    ${[123]}
    ${[null]}
  `("returns [] for invalid points $points", ({ points }) => {
    expect(
      intervalSplitAtUtc(
        "2024-01-01T00:00:00Z",
        "2024-01-10T00:00:00Z",
        points,
      ),
    ).toEqual([]);
  });

  it("returns [] when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      intervalSplitAtUtc("2024-01-01T00:00:00Z", "2024-01-10T00:00:00Z", [
        "2024-01-05T00:00:00Z",
      ]),
    ).toEqual([]);
  });
});

// A point on `start` or `end` is dropped, and no point lies strictly inside a zero-length
// interval, so the whole interval comes back unsplit: one piece whose `end` equals its `start`.
// This is the only way a piece can be empty.
describe("intervalSplitAtUtc on a zero-length interval", () => {
  it.each`
    points                      | why
    ${[]}                       | ${"no points"}
    ${["2024-01-05T12:00:00Z"]} | ${"a point on the interval's only value"}
  `(
    "returns the one empty piece for start = end = 2024-01-05T12:00:00Z with points $points ($why)",
    ({ points }) => {
      expect(
        intervalSplitAtUtc(
          "2024-01-05T12:00:00Z",
          "2024-01-05T12:00:00Z",
          points,
        ),
      ).toEqual([
        { start: "2024-01-05T12:00:00Z", end: "2024-01-05T12:00:00Z" },
      ]);
    },
  );
});
