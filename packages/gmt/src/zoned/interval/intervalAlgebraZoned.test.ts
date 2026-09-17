import { Temporal } from "@js-temporal/polyfill";
import {
  intersectIntervals,
  mergeIntervals,
  subtractIntervals,
} from "../../interval/calculate";
import { intervalContains, intervalsOverlap } from "../../interval/compare";
import type { Interval } from "../../types";
import { intervalContainsZoned } from "./intervalContainsZoned";
import { intervalDifferenceZoned } from "./intervalDifferenceZoned";
import { intervalIntersectionZoned } from "./intervalIntersectionZoned";
import { intervalsOverlapZoned } from "./intervalsOverlapZoned";
import { intervalUnionZoned } from "./intervalUnionZoned";
import { intervalXorAllZoned } from "./intervalXorAllZoned";
import { intervalXorZoned } from "./intervalXorZoned";
import { mergeIntervalsZoned } from "./mergeIntervalsZoned";

// Half-open delegation check (CORE-8): the positional Zoned families agree with the CORE-6 `interval/` reference
// for every interval pair drawn from a pool of instants 1 ns either side of the boundaries, so
// touching, 1 ns gaps, 1 ns overlaps, nesting and empty intervals are all enumerated. Each instant
// is spelled in UTC for `interval/` and, alternately, in America/New_York for the Zoned function,
// so zone-blind comparison is exercised too.
const instants = [
  "2024-01-01T09:00:00Z",
  "2024-01-01T11:59:59.999999999Z",
  "2024-01-01T12:00:00Z",
  "2024-01-01T12:00:00.000000001Z",
  "2024-01-01T13:00:00Z",
  "2024-01-01T17:00:00Z",
];
const zoned = (instant: string, k: number) =>
  Temporal.Instant.from(instant)
    .toZonedDateTimeISO(k % 2 === 0 ? "UTC" : "America/New_York")
    .toString();

type Pair = { utc: Interval; zoned: Interval };
const intervals: Pair[] = instants.flatMap((start, i) =>
  instants.slice(i).map((end, j) => ({
    utc: { start, end },
    zoned: { start: zoned(start, i), end: zoned(end, i + j + 1) },
  })),
);
const pairs = intervals.flatMap((a) => intervals.map((b) => [a, b] as const));

// Compare by instant: `interval/` echoes the caller's spelling, the Zoned functions re-serialise in
// the contributing input's zone.
const instantOf = (text: string) =>
  Temporal.ZonedDateTime.from(text).toInstant().toString();
const utcOf = (text: string) => Temporal.Instant.from(text).toString();
const zonedList = (list: Interval[]) =>
  list.map(({ start, end }) => ({
    start: instantOf(start),
    end: instantOf(end),
  }));
const utcList = (list: Interval[]) =>
  list.map(({ start, end }) => ({ start: utcOf(start), end: utcOf(end) }));

describe("positional Zoned interval functions agree with interval/", () => {
  it("enumerates 21 intervals and 441 ordered pairs", () => {
    expect(intervals).toHaveLength(21);
    expect(pairs).toHaveLength(441);
  });

  it("intervalsOverlapZoned equals intervalsOverlap for every pair", () => {
    for (const [a, b] of pairs) {
      expect(
        intervalsOverlapZoned(
          a.zoned.start,
          a.zoned.end,
          b.zoned.start,
          b.zoned.end,
        ),
      ).toBe(intervalsOverlap(a.utc, b.utc));
    }
  });

  it("intervalContainsZoned (point) equals intervalContains for every interval and point", () => {
    for (const { utc, zoned: z } of intervals) {
      instants.forEach((point, k) => {
        expect(intervalContainsZoned(z.start, z.end, zoned(point, k))).toBe(
          intervalContains(utc, point),
        );
      });
    }
  });

  it("intervalIntersectionZoned equals intersectIntervals by instant for every pair", () => {
    for (const [a, b] of pairs) {
      const expected = intersectIntervals(a.utc, b.utc);
      const actual = intervalIntersectionZoned(
        a.zoned.start,
        a.zoned.end,
        b.zoned.start,
        b.zoned.end,
      );
      expect(actual === null ? null : zonedList([actual])[0]).toEqual(
        expected === null ? null : utcList([expected])[0],
      );
    }
  });

  it("mergeIntervalsZoned equals mergeIntervals by instant for every pair and triple", () => {
    for (const [a, b] of pairs) {
      const c =
        intervals[
          (intervals.indexOf(a) * 7 + intervals.indexOf(b)) % intervals.length
        ];
      expect(zonedList(mergeIntervalsZoned([a.zoned, b.zoned]))).toEqual(
        utcList(mergeIntervals([a.utc, b.utc])),
      );
      expect(
        zonedList(mergeIntervalsZoned([a.zoned, b.zoned, c.zoned])),
      ).toEqual(utcList(mergeIntervals([a.utc, b.utc, c.utc])));
    }
  });

  it("intervalUnionZoned is the single run of mergeIntervals, else null, for every pair", () => {
    for (const [a, b] of pairs) {
      const runs = utcList(mergeIntervals([a.utc, b.utc]));
      const actual = intervalUnionZoned(
        a.zoned.start,
        a.zoned.end,
        b.zoned.start,
        b.zoned.end,
      );
      expect(actual === null ? null : zonedList([actual])[0]).toEqual(
        runs.length === 1 ? runs[0] : null,
      );
    }
  });

  it("intervalDifferenceZoned equals subtractIntervals by instant for every pair", () => {
    for (const [a, b] of pairs) {
      expect(
        zonedList(
          intervalDifferenceZoned(
            a.zoned.start,
            a.zoned.end,
            b.zoned.start,
            b.zoned.end,
          ),
        ),
      ).toEqual(utcList(subtractIntervals(a.utc, [b.utc])));
    }
  });

  it("intervalXorZoned and intervalXorAllZoned equal merge(subtract(a, b) + subtract(b, a)) for every pair", () => {
    for (const [a, b] of pairs) {
      const expected = utcList(
        mergeIntervals([
          ...subtractIntervals(a.utc, [b.utc]),
          ...subtractIntervals(b.utc, [a.utc]),
        ]),
      );
      expect(
        zonedList(
          intervalXorZoned(
            a.zoned.start,
            a.zoned.end,
            b.zoned.start,
            b.zoned.end,
          ),
        ),
      ).toEqual(expected);
      expect(zonedList(intervalXorAllZoned([a.zoned, b.zoned]))).toEqual(
        expected,
      );
    }
  });
});
