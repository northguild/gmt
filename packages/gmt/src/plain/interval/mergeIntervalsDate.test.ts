import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { mergeIntervalsDate } from "./mergeIntervalsDate";

describe("mergeIntervalsDate", () => {
  it("merges overlapping intervals", () => {
    expect(
      mergeIntervalsDate([
        { start: "2024-01-01", end: "2024-01-10" },
        { start: "2024-01-05", end: "2024-01-15" },
      ]),
    ).toEqual([{ start: "2024-01-01", end: "2024-01-15" }]);
  });

  it("merges adjacent intervals (shared endpoint)", () => {
    expect(
      mergeIntervalsDate([
        { start: "2024-01-01", end: "2024-01-10" },
        { start: "2024-01-10", end: "2024-01-20" },
      ]),
    ).toEqual([{ start: "2024-01-01", end: "2024-01-20" }]);
  });

  it("keeps disjoint intervals separate", () => {
    expect(
      mergeIntervalsDate([
        { start: "2024-01-01", end: "2024-01-05" },
        { start: "2024-01-10", end: "2024-01-15" },
      ]),
    ).toEqual([
      { start: "2024-01-01", end: "2024-01-05" },
      { start: "2024-01-10", end: "2024-01-15" },
    ]);
  });

  it("keeps a 1-day gap separate (not adjacent)", () => {
    expect(
      mergeIntervalsDate([
        { start: "2024-01-01", end: "2024-01-05" },
        { start: "2024-01-06", end: "2024-01-10" },
      ]),
    ).toEqual([
      { start: "2024-01-01", end: "2024-01-05" },
      { start: "2024-01-06", end: "2024-01-10" },
    ]);
  });

  it("collapses a fully-overlapping interval", () => {
    expect(
      mergeIntervalsDate([
        { start: "2024-01-01", end: "2024-01-20" },
        { start: "2024-01-05", end: "2024-01-10" },
      ]),
    ).toEqual([{ start: "2024-01-01", end: "2024-01-20" }]);
  });

  it("does not depend on input order", () => {
    expect(
      mergeIntervalsDate([
        { start: "2024-01-10", end: "2024-01-20" },
        { start: "2024-01-01", end: "2024-01-05" },
      ]),
    ).toEqual([
      { start: "2024-01-01", end: "2024-01-05" },
      { start: "2024-01-10", end: "2024-01-20" },
    ]);
  });

  it("returns [] for an empty list", () => {
    expect(mergeIntervalsDate([])).toEqual([]);
  });

  it.each`
    intervals
    ${"not-an-array"}
    ${[{ start: "2024-01-10", end: "2024-01-01" }]}
    ${[{ start: "invalid", end: "2024-01-01" }]}
    ${[{ start: "2024-01-01", end: "2024-01-10" }, "not-an-object"]}
  `("returns [] for invalid intervals $intervals", ({ intervals }) => {
    expect(mergeIntervalsDate(intervals)).toEqual([]);
  });

  it("preserves a single zero-length interval", () => {
    expect(
      mergeIntervalsDate([{ start: "2024-01-01", end: "2024-01-01" }]),
    ).toEqual([{ start: "2024-01-01", end: "2024-01-01" }]);
  });

  it("merges a zero-length interval with an overlapping interval", () => {
    expect(
      mergeIntervalsDate([
        { start: "2024-01-01", end: "2024-01-01" },
        { start: "2024-01-01", end: "2024-01-10" },
      ]),
    ).toEqual([{ start: "2024-01-01", end: "2024-01-10" }]);
  });

  it("keeps a zero-length interval separate from a disjoint interval", () => {
    expect(
      mergeIntervalsDate([
        { start: "2024-01-01", end: "2024-01-01" },
        { start: "2024-01-05", end: "2024-01-10" },
      ]),
    ).toEqual([
      { start: "2024-01-01", end: "2024-01-01" },
      { start: "2024-01-05", end: "2024-01-10" },
    ]);
  });

  it("returns [] when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      mergeIntervalsDate([{ start: "2024-01-01", end: "2024-01-10" }]),
    ).toEqual([]);
  });
});
