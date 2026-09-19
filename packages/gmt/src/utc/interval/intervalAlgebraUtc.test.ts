import { Temporal } from "@js-temporal/polyfill";
import {
  intersectIntervals,
  mergeIntervals,
  subtractIntervals,
} from "../../interval/calculate";
import { intervalContains, intervalsOverlap } from "../../interval/compare";
import type { Interval } from "../../types";
import { intervalContainsUtc } from "./intervalContainsUtc";
import { intervalDifferenceUtc } from "./intervalDifferenceUtc";
import { intervalIntersectionUtc } from "./intervalIntersectionUtc";
import { intervalsOverlapUtc } from "./intervalsOverlapUtc";
import { intervalUnionUtc } from "./intervalUnionUtc";
import { intervalXorUtc } from "./intervalXorUtc";
import { mergeIntervalsUtc } from "./mergeIntervalsUtc";

// Half-open delegation check (CORE-8): the positional Utc families agree with the CORE-6 `interval/` reference
// for every interval pair drawn from a pool of instants 1 ns either side of the boundaries, so
// touching, 1 ns gaps, 1 ns overlaps, nesting and empty intervals are all enumerated.
const points = [
  "2024-01-01T09:00:00Z",
  "2024-01-01T11:59:59.999999999Z",
  "2024-01-01T12:00:00Z",
  "2024-01-01T12:00:00.000000001Z",
  "2024-01-01T13:00:00Z",
  "2024-01-01T17:00:00Z",
];
const intervals: Interval[] = points.flatMap((start, i) =>
  points.slice(i).map((end) => ({ start, end })),
);
const pairs = intervals.flatMap((a) => intervals.map((b) => [a, b] as const));

// `interval/` echoes the caller's spelling; the positional functions re-serialise.
const canonical = (text: string) => Temporal.Instant.from(text).toString();
const canonicalList = (list: Interval[]) =>
  list.map(({ start, end }) => ({
    start: canonical(start),
    end: canonical(end),
  }));

describe("positional Utc interval functions agree with interval/", () => {
  it("enumerates 21 intervals and 441 ordered pairs", () => {
    expect(intervals).toHaveLength(21);
    expect(pairs).toHaveLength(441);
  });

  it("intervalsOverlapUtc equals intervalsOverlap for every pair", () => {
    for (const [a, b] of pairs) {
      expect(intervalsOverlapUtc(a.start, a.end, b.start, b.end)).toBe(
        intervalsOverlap(a, b),
      );
    }
  });

  it("intervalContainsUtc (point) equals intervalContains for every interval and point", () => {
    for (const interval of intervals) {
      for (const point of points) {
        expect(intervalContainsUtc(interval.start, interval.end, point)).toBe(
          intervalContains(interval, point),
        );
      }
    }
  });

  it("intervalIntersectionUtc equals intersectIntervals (re-serialised) for every pair", () => {
    for (const [a, b] of pairs) {
      const expected = intersectIntervals(a, b);
      expect(intervalIntersectionUtc(a.start, a.end, b.start, b.end)).toEqual(
        expected === null ? null : canonicalList([expected])[0],
      );
    }
  });

  it("mergeIntervalsUtc equals mergeIntervals (re-serialised) for every pair and triple", () => {
    for (const [a, b] of pairs) {
      expect(mergeIntervalsUtc([a, b])).toEqual(
        canonicalList(mergeIntervals([a, b])),
      );
      const c =
        intervals[
          (intervals.indexOf(a) * 7 + intervals.indexOf(b)) % intervals.length
        ];
      expect(mergeIntervalsUtc([a, b, c])).toEqual(
        canonicalList(mergeIntervals([a, b, c])),
      );
    }
  });

  it("intervalDifferenceUtc equals subtractIntervals (re-serialised) for every pair", () => {
    for (const [a, b] of pairs) {
      expect(intervalDifferenceUtc(a.start, a.end, b.start, b.end)).toEqual(
        canonicalList(subtractIntervals(a, [b])),
      );
    }
  });

  it("intervalXorUtc equals mergeIntervals(subtract(a, [b]) ++ subtract(b, [a])) for every pair", () => {
    for (const [a, b] of pairs) {
      expect(intervalXorUtc(a.start, a.end, b.start, b.end)).toEqual(
        canonicalList(
          mergeIntervals([
            ...subtractIntervals(a, [b]),
            ...subtractIntervals(b, [a]),
          ]),
        ),
      );
    }
  });

  it("intervalUnionUtc is the single run of mergeIntervals, else null, for every pair", () => {
    for (const [a, b] of pairs) {
      const runs = canonicalList(mergeIntervals([a, b]));
      expect(intervalUnionUtc(a.start, a.end, b.start, b.end)).toEqual(
        runs.length === 1 ? runs[0] : null,
      );
    }
  });
});
