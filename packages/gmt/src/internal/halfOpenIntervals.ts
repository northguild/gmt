/**
 * Half-open `[start, end)` interval algebra over any totally ordered value type.
 *
 * `t ∈ [start, end) ⇔ start ≤ t < end` — EWD831, SQL:2011 closed-open `PERIOD`
 * (ISO/IEC 9075-2:2011) and RFC 5545 §3.6.1 non-inclusive `DTEND`. These helpers carry the same
 * rules as the CORE-6 `interval/` namespace (see `context/domination/specs/CORE-6-spec.md` §3)
 * for the positional families whose values are not instants (`PlainDate`, `PlainDateTime`,
 * `PlainTime`) and for the relations `interval/` has no function for.
 *
 * - `compare` returns a negative, zero or positive number, like `Temporal.*.compare`.
 * - Callers validate first: every span passed in has `start ≤ end`.
 * - No helper ever steps a value by one unit, so nothing can overflow a type's range or wrap a
 *   `PlainTime` past midnight.
 * - Every returned span is a fresh object holding values from the inputs.
 */

type Compare<T> = (left: T, right: T) => number;

/** A validated `[start, end)` span of one value type. */
export interface HalfOpenSpan<T> {
  start: T;
  end: T;
}

/**
 * True when the spans share at least one value: `a.start < b.end && b.start < a.end`.
 * Touching spans do not overlap, and an empty span overlaps only when strictly inside the other.
 *
 * @example halfOpenOverlap({ start: 1, end: 5 }, { start: 3, end: 8 }, (x, y) => x - y) // true
 * @example halfOpenOverlap({ start: 1, end: 3 }, { start: 3, end: 5 }, (x, y) => x - y) // false (touching)
 */
export function halfOpenOverlap<T>(
  a: HalfOpenSpan<T>,
  b: HalfOpenSpan<T>,
  compare: Compare<T>,
): boolean {
  return compare(a.start, b.end) < 0 && compare(b.start, a.end) < 0;
}

/**
 * True when `start ≤ point < end`. An empty span contains no value.
 *
 * @example halfOpenContainsPoint({ start: 1, end: 5 }, 1, (x, y) => x - y) // true
 * @example halfOpenContainsPoint({ start: 1, end: 5 }, 5, (x, y) => x - y) // false (end is excluded)
 */
export function halfOpenContainsPoint<T>(
  span: HalfOpenSpan<T>,
  point: T,
  compare: Compare<T>,
): boolean {
  return compare(span.start, point) <= 0 && compare(point, span.end) < 0;
}

/**
 * True when `inner` lies within `outer` and the two overlap. For a non-empty `inner` this is
 * `outer.start ≤ inner.start && inner.end ≤ outer.end`; an empty `inner` counts only strictly
 * inside `outer`, matching CORE-6's `clampInterval`, which clamps an empty interval at an edge to
 * `null` and one strictly inside to itself.
 *
 * @example halfOpenContainsSpan({ start: 1, end: 9 }, { start: 3, end: 9 }, (x, y) => x - y) // true
 * @example halfOpenContainsSpan({ start: 1, end: 9 }, { start: 9, end: 9 }, (x, y) => x - y) // false (empty at the edge)
 */
export function halfOpenContainsSpan<T>(
  outer: HalfOpenSpan<T>,
  inner: HalfOpenSpan<T>,
  compare: Compare<T>,
): boolean {
  return (
    halfOpenOverlap(outer, inner, compare) &&
    compare(outer.start, inner.start) <= 0 &&
    compare(inner.end, outer.end) <= 0
  );
}

/**
 * The shared span `[max(starts), min(ends))`, or `null` when the spans do not overlap.
 * `halfOpenIntersection(a, b) !== null ⇔ halfOpenOverlap(a, b)` by construction.
 *
 * @example halfOpenIntersection({ start: 1, end: 5 }, { start: 3, end: 8 }, (x, y) => x - y) // { start: 3, end: 5 }
 * @example halfOpenIntersection({ start: 1, end: 3 }, { start: 3, end: 5 }, (x, y) => x - y) // null (touching)
 */
export function halfOpenIntersection<T>(
  a: HalfOpenSpan<T>,
  b: HalfOpenSpan<T>,
  compare: Compare<T>,
): HalfOpenSpan<T> | null {
  if (!halfOpenOverlap(a, b, compare)) {
    return null;
  }

  return {
    start: compare(a.start, b.start) >= 0 ? a.start : b.start,
    end: compare(a.end, b.end) <= 0 ? a.end : b.end,
  };
}

/**
 * Coalesce spans into sorted, disjoint, non-touching, non-empty runs (CORE-6
 * `coalesceIntervalNanoseconds`): touching spans join, an empty span touching or inside a run is
 * absorbed, and an empty span nothing touches is dropped.
 *
 * @example halfOpenMerge([{ start: 3, end: 8 }, { start: 1, end: 3 }], (x, y) => x - y) // [{ start: 1, end: 8 }]
 * @example halfOpenMerge([{ start: 5, end: 5 }], (x, y) => x - y) // []
 */
export function halfOpenMerge<T>(
  spans: ReadonlyArray<HalfOpenSpan<T>>,
  compare: Compare<T>,
): Array<HalfOpenSpan<T>> {
  const sorted = [...spans].sort((left, right) =>
    compare(left.start, right.start),
  );
  const runs: Array<HalfOpenSpan<T>> = [];

  for (const span of sorted) {
    const last = runs[runs.length - 1];

    if (last !== undefined && compare(span.start, last.end) <= 0) {
      if (compare(span.end, last.end) > 0) {
        last.end = span.end;
      }
    } else {
      runs.push({ start: span.start, end: span.end });
    }
  }

  return runs.filter((run) => compare(run.start, run.end) < 0);
}

/**
 * The union of two spans when it is one non-empty span, otherwise `null` — the single run of
 * `halfOpenMerge([a, b])`. Touching spans join; spans with a gap, and two empty spans, give `null`.
 *
 * @example halfOpenUnion({ start: 1, end: 3 }, { start: 3, end: 5 }, (x, y) => x - y) // { start: 1, end: 5 }
 * @example halfOpenUnion({ start: 1, end: 3 }, { start: 4, end: 5 }, (x, y) => x - y) // null (gap)
 */
export function halfOpenUnion<T>(
  a: HalfOpenSpan<T>,
  b: HalfOpenSpan<T>,
  compare: Compare<T>,
): HalfOpenSpan<T> | null {
  const runs = halfOpenMerge([a, b], compare);

  return runs.length === 1 ? runs[0] : null;
}

/**
 * The parts of `from` not covered by any span in `remove`, sorted and non-empty (CORE-6
 * `subtractIntervals`). Pieces end exactly where a removal starts and start exactly where one
 * ends.
 *
 * @example halfOpenDifference({ start: 1, end: 9 }, [{ start: 3, end: 5 }], (x, y) => x - y) // [{ start: 1, end: 3 }, { start: 5, end: 9 }]
 * @example halfOpenDifference({ start: 1, end: 9 }, [{ start: 1, end: 9 }], (x, y) => x - y) // []
 */
export function halfOpenDifference<T>(
  from: HalfOpenSpan<T>,
  remove: ReadonlyArray<HalfOpenSpan<T>>,
  compare: Compare<T>,
): Array<HalfOpenSpan<T>> {
  const pieces: Array<HalfOpenSpan<T>> = [];
  let cursor = from.start;

  for (const run of halfOpenMerge(remove, compare)) {
    if (compare(run.start, from.end) >= 0) {
      break;
    }

    if (compare(run.end, cursor) <= 0) {
      continue;
    }

    if (compare(run.start, cursor) > 0) {
      pieces.push({ start: cursor, end: run.start });
    }

    cursor = run.end;
  }

  if (compare(cursor, from.end) < 0) {
    pieces.push({ start: cursor, end: from.end });
  }

  return pieces;
}

/**
 * The symmetric difference of any number of spans: every maximal run of values covered an odd
 * number of times, sorted by start.
 *
 * Every start and end is a boundary. At each distinct boundary value the coverage parity flips
 * when the number of starts plus ends there is odd. A span's own start and end cancel when it is
 * empty, and one span ending where another starts leaves the parity unchanged, so touching odd
 * runs come out as one maximal run.
 *
 * @example halfOpenXor([{ start: 1, end: 5 }, { start: 3, end: 8 }], (x, y) => x - y) // [{ start: 1, end: 3 }, { start: 5, end: 8 }]
 * @example halfOpenXor([{ start: 1, end: 3 }, { start: 3, end: 5 }], (x, y) => x - y) // [{ start: 1, end: 5 }]
 */
export function halfOpenXor<T>(
  spans: ReadonlyArray<HalfOpenSpan<T>>,
  compare: Compare<T>,
): Array<HalfOpenSpan<T>> {
  const boundaries = spans
    .flatMap((span) => [span.start, span.end])
    .sort(compare);
  const result: Array<HalfOpenSpan<T>> = [];
  let runStart: T | null = null;
  let index = 0;

  while (index < boundaries.length) {
    const point = boundaries[index];
    let count = 0;

    while (
      index < boundaries.length &&
      compare(boundaries[index], point) === 0
    ) {
      count += 1;
      index += 1;
    }

    if (count % 2 === 0) {
      continue;
    }

    if (runStart === null) {
      runStart = point;
    } else {
      result.push({ start: runStart, end: point });
      runStart = null;
    }
  }

  return result;
}

/**
 * True when one non-empty span ends exactly where the other non-empty span starts — they share
 * no value and leave no gap (Allen's "meets", in either order). An empty span abuts nothing.
 *
 * @example halfOpenAbuts({ start: 1, end: 3 }, { start: 3, end: 5 }, (x, y) => x - y) // true
 * @example halfOpenAbuts({ start: 1, end: 3 }, { start: 4, end: 5 }, (x, y) => x - y) // false (gap)
 */
export function halfOpenAbuts<T>(
  a: HalfOpenSpan<T>,
  b: HalfOpenSpan<T>,
  compare: Compare<T>,
): boolean {
  if (compare(a.start, a.end) === 0 || compare(b.start, b.end) === 0) {
    return false;
  }

  return compare(a.end, b.start) === 0 || compare(b.end, a.start) === 0;
}
