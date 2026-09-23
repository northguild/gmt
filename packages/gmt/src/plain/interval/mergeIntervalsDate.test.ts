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

  it("absorbs a zero-length interval at a run's end: [01-10, 01-10) after [01-01, 01-10)", () => {
    expect(
      mergeIntervalsDate([
        { start: "2024-01-01", end: "2024-01-10" },
        { start: "2024-01-10", end: "2024-01-10" },
      ]),
    ).toEqual([{ start: "2024-01-01", end: "2024-01-10" }]);
  });

  it("keeps a 1-day gap separate: [01-01, 01-05) leaves 01-05 uncovered", () => {
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

  // Half-open: an empty interval holds no day. It is absorbed by a run it touches or lies in, and
  // dropped when nothing touches it (CORE-6 §1.2 coalesce).
  it("drops a single zero-length interval: [2024-01-01, 2024-01-01) is empty", () => {
    expect(
      mergeIntervalsDate([{ start: "2024-01-01", end: "2024-01-01" }]),
    ).toEqual([]);
  });

  it("merges a zero-length interval with an overlapping interval", () => {
    expect(
      mergeIntervalsDate([
        { start: "2024-01-01", end: "2024-01-01" },
        { start: "2024-01-01", end: "2024-01-10" },
      ]),
    ).toEqual([{ start: "2024-01-01", end: "2024-01-10" }]);
  });

  it("drops a zero-length interval that touches nothing: [01-01, 01-01) beside [01-05, 01-10)", () => {
    expect(
      mergeIntervalsDate([
        { start: "2024-01-01", end: "2024-01-01" },
        { start: "2024-01-05", end: "2024-01-10" },
      ]),
    ).toEqual([{ start: "2024-01-05", end: "2024-01-10" }]);
  });

  it("returns [] when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      mergeIntervalsDate([{ start: "2024-01-01", end: "2024-01-10" }]),
    ).toEqual([]);
  });
  // E5 (issue #78): every start/end across the whole list must share the same calendar tag
  // (D4). Golden verified directly against @js-temporal/polyfill.
  it("merges in the shared calendar when every interval carries the same tag", () => {
    expect(
      mergeIntervalsDate([
        { start: "2023-09-16[u-ca=hebrew]", end: "2023-09-25[u-ca=hebrew]" },
        { start: "2023-09-20[u-ca=hebrew]", end: "2023-10-05[u-ca=hebrew]" },
      ]),
    ).toEqual([
      { start: "2023-09-16[u-ca=hebrew]", end: "2023-10-05[u-ca=hebrew]" },
    ]);
  });

  it("returns [] when any interval in the list carries a mismatched calendar tag", () => {
    expect(
      mergeIntervalsDate([
        { start: "2023-09-16[u-ca=hebrew]", end: "2023-09-25[u-ca=hebrew]" },
        { start: "2024-01-05", end: "2024-01-20" },
      ]),
    ).toEqual([]);
  });
});
