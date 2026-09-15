/**
 * Operations the closed-interval XOR sweep needs for one value type.
 *
 * - `compare` returns a negative, zero or positive number, like `Temporal.*.compare`.
 * - `stepUp` / `stepDown` move one unit (1 ns, 1 day, 1 epoch unit). The sweep only calls them
 *   where the result is guaranteed to exist, so they may throw at the type's range limits.
 */
export interface ClosedXorOps<T> {
  compare: (left: T, right: T) => number;
  stepUp: (value: T) => T;
  stepDown: (value: T) => T;
}

type SweepEvent<T> = { point: T; opens: boolean };
type SweepGroup<T> = SweepEvent<T> & { count: number };

/**
 * Every start as an OPEN event and every end as a CLOSE event, sorted by point with opens first
 * at an equal point (a zero-length interval covers its point).
 */
function sortedEvents<T>(
  intervals: ReadonlyArray<{ start: T; end: T }>,
  compare: (left: T, right: T) => number,
): Array<SweepEvent<T>> {
  const events = intervals.flatMap(({ start, end }) => [
    { point: start, opens: true },
    { point: end, opens: false },
  ]);

  return events.sort((left, right) => {
    const byPoint = compare(left.point, right.point);
    if (byPoint !== 0 || left.opens === right.opens) {
      return byPoint;
    }

    return left.opens ? -1 : 1;
  });
}

/** Collapse consecutive events with the same point and kind into one counted group. */
function groupEvents<T>(
  events: ReadonlyArray<SweepEvent<T>>,
  compare: (left: T, right: T) => number,
): Array<SweepGroup<T>> {
  const groups: Array<SweepGroup<T>> = [];

  for (const event of events) {
    const last = groups[groups.length - 1];
    const sameGroup =
      last !== undefined &&
      last.opens === event.opens &&
      compare(last.point, event.point) === 0;

    if (sameGroup) {
      last.count += 1;
    } else {
      groups.push({ ...event, count: 1 });
    }
  }

  return groups;
}

/**
 * Compute the symmetric difference of closed intervals `[start, end]`: every maximal run of
 * values covered an odd number of times.
 *
 * Each interval contributes an OPEN event at its start and a CLOSE event at its end — never at
 * `end + 1`, which would throw at the type's maximum or wrap on `PlainTime`
 * (`23:59:59.999999999 + 1 ns` is `00:00:00`). Events sort by point, with opens before closes at the
 * same point (a zero-length interval covers its point), and are grouped by `(point, kind)`. A
 * group with an odd count flips the coverage parity:
 *
 * - turning odd at an open starts a run at the point; at a close, one unit after it. The step up
 *   is safe because coverage continues past that point, so it is not the maximum.
 * - turning even at an open ends the run one unit before the point; at a close, at the point.
 *   The step down is safe because the run started earlier, so the point is not the minimum.
 *
 * A run starting exactly one unit after the previous run's end extends that run, so results are
 * maximal (`[1, 3]` and `[4, 6]` give `[1, 6]`). Input intervals must already be validated and
 * ordered (`start <= end`); the result is sorted by start. Grouping keeps the first event of each
 * group, so a zoned caller's boundary carries the zone of the interval that contributed it.
 *
 * @example closedXorSweep([{ start: 1, end: 10 }, { start: 4, end: 6 }], ops) // [{ start: 1, end: 3 }, { start: 7, end: 10 }]
 * @example closedXorSweep([{ start: 1, end: 3 }, { start: 4, end: 6 }], ops) // [{ start: 1, end: 6 }]
 * @example closedXorSweep([{ start: 1, end: 3 }, { start: 1, end: 3 }], ops) // []
 */
export function closedXorSweep<T>(
  intervals: ReadonlyArray<{ start: T; end: T }>,
  { compare, stepUp, stepDown }: ClosedXorOps<T>,
): Array<{ start: T; end: T }> {
  const groups = groupEvents(sortedEvents(intervals, compare), compare);
  const oddGroups = groups.filter((group) => group.count % 2 === 1);

  const result: Array<{ start: T; end: T }> = [];
  let runStart: T | null = null;

  for (const group of oddGroups) {
    if (runStart !== null) {
      // Parity turns even: the run ends one unit before an open, or at a close.
      result.push({
        start: runStart,
        end: group.opens ? stepDown(group.point) : group.point,
      });
      runStart = null;
      continue;
    }

    // Parity turns odd: the run starts at an open, or one unit after a close.
    const start = group.opens ? group.point : stepUp(group.point);
    const previous = result[result.length - 1];
    const extendsPrevious =
      previous !== undefined && compare(stepDown(start), previous.end) === 0;

    if (extendsPrevious) {
      result.pop();
    }

    runStart = extendsPrevious ? previous.start : start;
  }

  return result;
}
