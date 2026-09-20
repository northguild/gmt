import { describe, expect, it } from "vitest";

import {
  intervalXorAllDate,
  intervalXorAllDateTime,
  intervalXorAllTime,
  mergeIntervalsDate,
  mergeIntervalsDateTime,
  mergeIntervalsTime,
} from "../plain";
import { intervalXorAllUnix, mergeIntervalsUnix } from "../unix";
import { intervalXorAllUtc, mergeIntervalsUtc } from "../utc";
import { intervalXorAllZoned, mergeIntervalsZoned } from "../zoned";

/**
 * `mergeIntervals*` and `intervalXorAll*` against a brute-force oracle, for lists longer than the
 * two elements their own suites pin.
 *
 * Every case is built on a grid of GRID_POINTS ordered values, so an interval is a pair of grid
 * indices and the answer is a set of indices: the union for `merge`, the odd-covered indices for
 * `xorAll`. The oracle counts those directly, and the function's own output is mapped back to grid
 * indices and expanded, so the two are compared as sets rather than as spans. The structural
 * invariants each family promises — sorted by start, disjoint, no empty span, and for `merge` no
 * two spans that touch — are asserted on every case as well.
 *
 * The generator is a seeded LCG, so a failure names the exact case and reproduces.
 */

const GRID_POINTS = 24;
const CASES_PER_SIZE = 12;
const SIZES = [3, 4, 5, 6, 8] as const;

/** Numerical Recipes' LCG — reproducible across engines, and good enough to pick grid indices. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

type IndexSpan = { startIndex: number; endIndex: number };

/** Random spans on the grid; `startIndex === endIndex` is allowed, and is the empty span. */
function randomSpans(random: () => number, count: number): Array<IndexSpan> {
  return Array.from({ length: count }, () => {
    const a = Math.floor(random() * GRID_POINTS);
    const b = Math.floor(random() * GRID_POINTS);
    return { startIndex: Math.min(a, b), endIndex: Math.max(a, b) };
  });
}

/** How many input spans cover each half-open grid cell [i, i+1). */
function coverCounts(spans: ReadonlyArray<IndexSpan>): Array<number> {
  const counts = Array.from({ length: GRID_POINTS }, () => 0);
  for (const span of spans) {
    for (let i = span.startIndex; i < span.endIndex; i += 1) {
      counts[i] += 1;
    }
  }
  return counts;
}

const cellsCoveredAtAll = (counts: ReadonlyArray<number>): Array<number> =>
  counts.flatMap((count, i) => (count > 0 ? [i] : []));

const cellsCoveredOddly = (counts: ReadonlyArray<number>): Array<number> =>
  counts.flatMap((count, i) => (count % 2 === 1 ? [i] : []));

/** Expand result spans back into the grid cells they cover. */
function cellsOf(spans: ReadonlyArray<IndexSpan>): Array<number> {
  const cells: Array<number> = [];
  for (const span of spans) {
    for (let i = span.startIndex; i < span.endIndex; i += 1) {
      cells.push(i);
    }
  }
  return cells;
}

interface Family<T> {
  readonly name: string;
  /** The ordered grid of values this family's intervals are built from. */
  readonly grid: ReadonlyArray<T>;
  readonly merge: (
    intervals: Array<{ start: T; end: T }>,
  ) => Array<{ start: T; end: T }>;
  readonly xorAll: (
    intervals: Array<{ start: T; end: T }>,
  ) => Array<{ start: T; end: T }>;
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** 24 consecutive days from 2024-03-01, as each family spells them. */
const days = Array.from({ length: GRID_POINTS }, (_, i) => i + 1);

const families: Array<Family<never>> = [
  {
    name: "Date",
    grid: days.map((d) => `2024-03-${pad(d)}`),
    merge: mergeIntervalsDate,
    xorAll: intervalXorAllDate,
  },
  {
    name: "DateTime",
    grid: days.map((d) => `2024-03-${pad(d)}T00:00:00`),
    merge: mergeIntervalsDateTime,
    xorAll: intervalXorAllDateTime,
  },
  {
    name: "Time",
    // Hours 00:00:00 .. 23:00:00 — a time grid has only 24 points in it.
    grid: days.map((d) => `${pad(d - 1)}:00:00`),
    merge: mergeIntervalsTime,
    xorAll: intervalXorAllTime,
  },
  {
    name: "Utc",
    grid: days.map((d) => `2024-03-${pad(d)}T00:00:00Z`),
    merge: mergeIntervalsUtc,
    xorAll: intervalXorAllUtc,
  },
  {
    name: "Zoned",
    grid: days.map((d) => `2024-03-${pad(d)}T00:00:00+00:00[UTC]`),
    merge: mergeIntervalsZoned,
    xorAll: intervalXorAllZoned,
  },
  {
    name: "Unix",
    grid: days.map((d) => (d - 1) * 86_400_000),
    merge: mergeIntervalsUnix,
    xorAll: intervalXorAllUnix,
  },
] as unknown as Array<Family<never>>;

describe("interval set algebra against a brute-force oracle", () => {
  for (const family of families as unknown as Array<Family<string | number>>) {
    const indexOf = new Map(family.grid.map((value, i) => [value, i]));

    /** Map a result span back to grid indices; an off-grid boundary fails the case. */
    const toIndexSpans = (
      spans: ReadonlyArray<{ start: string | number; end: string | number }>,
    ): Array<IndexSpan> =>
      spans.map((span) => {
        const startIndex = indexOf.get(span.start);
        const endIndex = indexOf.get(span.end);
        expect({
          start: span.start,
          startIndex,
          end: span.end,
          endIndex,
        }).toEqual({
          start: span.start,
          startIndex: expect.any(Number),
          end: span.end,
          endIndex: expect.any(Number),
        });
        return { startIndex: startIndex ?? -1, endIndex: endIndex ?? -1 };
      });

    const toIntervals = (
      spans: ReadonlyArray<IndexSpan>,
    ): Array<{ start: string | number; end: string | number }> =>
      spans.map((span) => ({
        start: family.grid[span.startIndex],
        end: family.grid[span.endIndex],
      }));

    for (const size of SIZES) {
      for (let caseIndex = 0; caseIndex < CASES_PER_SIZE; caseIndex += 1) {
        const seed = size * 1_000 + caseIndex;
        const spans = randomSpans(lcg(seed), size);
        const counts = coverCounts(spans);
        const input = toIntervals(spans);

        it(`merges ${size} intervals to their union (${family.name}, seed ${seed})`, () => {
          const result = toIndexSpans(family.merge([...input] as never));

          expect(cellsOf(result)).toEqual(cellsCoveredAtAll(counts));
          for (const span of result) {
            expect(span.endIndex).toBeGreaterThan(span.startIndex);
          }
          for (let i = 1; i < result.length; i += 1) {
            // Sorted, disjoint, and never merely touching: a union leaves no seam.
            expect(result[i].startIndex).toBeGreaterThan(
              result[i - 1].endIndex,
            );
          }
        });

        it(`xors ${size} intervals to their odd cover (${family.name}, seed ${seed})`, () => {
          const result = toIndexSpans(family.xorAll([...input] as never));

          expect(cellsOf(result)).toEqual(cellsCoveredOddly(counts));
          for (const span of result) {
            expect(span.endIndex).toBeGreaterThan(span.startIndex);
          }
          for (let i = 1; i < result.length; i += 1) {
            expect(result[i].startIndex).toBeGreaterThan(
              result[i - 1].endIndex,
            );
          }
        });
      }
    }
  }
});
