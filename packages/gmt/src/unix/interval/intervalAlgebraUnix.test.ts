import { Temporal } from "@js-temporal/polyfill";
import {
  intersectIntervals,
  mergeIntervals,
  subtractIntervals,
} from "../../interval/calculate";
import { intervalContains, intervalsOverlap } from "../../interval/compare";
import type { Interval } from "../../types";
import { intervalContainsUnix } from "./intervalContainsUnix";
import { intervalDifferenceUnix } from "./intervalDifferenceUnix";
import { intervalIntersectionUnix } from "./intervalIntersectionUnix";
import { intervalsOverlapUnix } from "./intervalsOverlapUnix";
import { intervalUnionUnix } from "./intervalUnionUnix";
import { intervalXorAllUnix } from "./intervalXorAllUnix";
import { intervalXorUnix } from "./intervalXorUnix";
import { mergeIntervalsUnix } from "./mergeIntervalsUnix";

// Half-open delegation check (CORE-8): the positional Unix families agree with the CORE-6 `interval/` reference
// for every interval pair drawn from a pool of epoch milliseconds one unit either side of the
// boundaries (2024-01-01T09:00Z, 12:00Z, 13:00Z, 17:00Z), so touching, one-unit gaps and overlaps,
// nesting and empty intervals are all enumerated. Each value is handed to `interval/` as the ISO
// instant it names.
const points = [
  1704099600000, 1704110399999, 1704110400000, 1704110400001, 1704114000000,
  1704128400000,
];
type Span = { start: number; end: number };
const intervals: Span[] = points.flatMap((start, i) =>
  points.slice(i).map((end) => ({ start, end })),
);
const pairs = intervals.flatMap((a) => intervals.map((b) => [a, b] as const));

const iso = (ms: number) =>
  Temporal.Instant.fromEpochMilliseconds(ms).toString();
const toInterval = ({ start, end }: Span): Interval => ({
  start: iso(start),
  end: iso(end),
});
const toSpans = (list: Interval[]): Span[] =>
  list.map(({ start, end }) => ({
    start: Temporal.Instant.from(start).epochMilliseconds,
    end: Temporal.Instant.from(end).epochMilliseconds,
  }));

describe("positional Unix interval functions agree with interval/", () => {
  it("enumerates 21 intervals and 441 ordered pairs", () => {
    expect(intervals).toHaveLength(21);
    expect(pairs).toHaveLength(441);
  });

  it("intervalsOverlapUnix equals intervalsOverlap for every pair", () => {
    for (const [a, b] of pairs) {
      expect(intervalsOverlapUnix(a.start, a.end, b.start, b.end)).toBe(
        intervalsOverlap(toInterval(a), toInterval(b)),
      );
    }
  });

  it("intervalContainsUnix (point) equals intervalContains for every interval and point", () => {
    for (const interval of intervals) {
      for (const point of points) {
        expect(intervalContainsUnix(interval.start, interval.end, point)).toBe(
          intervalContains(toInterval(interval), iso(point)),
        );
      }
    }
  });

  it("intervalIntersectionUnix equals intersectIntervals for every pair", () => {
    for (const [a, b] of pairs) {
      const expected = intersectIntervals(toInterval(a), toInterval(b));
      expect(intervalIntersectionUnix(a.start, a.end, b.start, b.end)).toEqual(
        expected === null ? null : toSpans([expected])[0],
      );
    }
  });

  it("mergeIntervalsUnix equals mergeIntervals for every pair and triple", () => {
    for (const [a, b] of pairs) {
      const c =
        intervals[
          (intervals.indexOf(a) * 7 + intervals.indexOf(b)) % intervals.length
        ];
      expect(mergeIntervalsUnix([a, b])).toEqual(
        toSpans(mergeIntervals([toInterval(a), toInterval(b)])),
      );
      expect(mergeIntervalsUnix([a, b, c])).toEqual(
        toSpans(mergeIntervals([toInterval(a), toInterval(b), toInterval(c)])),
      );
    }
  });

  it("intervalUnionUnix is the single run of mergeIntervals, else null, for every pair", () => {
    for (const [a, b] of pairs) {
      const runs = toSpans(mergeIntervals([toInterval(a), toInterval(b)]));
      expect(intervalUnionUnix(a.start, a.end, b.start, b.end)).toEqual(
        runs.length === 1 ? runs[0] : null,
      );
    }
  });

  it("intervalDifferenceUnix equals subtractIntervals for every pair", () => {
    for (const [a, b] of pairs) {
      expect(intervalDifferenceUnix(a.start, a.end, b.start, b.end)).toEqual(
        toSpans(subtractIntervals(toInterval(a), [toInterval(b)])),
      );
    }
  });

  it("intervalXorUnix and intervalXorAllUnix equal merge(subtract(a, b) + subtract(b, a)) for every pair", () => {
    for (const [a, b] of pairs) {
      const expected = toSpans(
        mergeIntervals([
          ...subtractIntervals(toInterval(a), [toInterval(b)]),
          ...subtractIntervals(toInterval(b), [toInterval(a)]),
        ]),
      );
      expect(intervalXorUnix(a.start, a.end, b.start, b.end)).toEqual(expected);
      expect(intervalXorAllUnix([a, b])).toEqual(expected);
    }
  });
});
