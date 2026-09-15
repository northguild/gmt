/**
 * Decide whether two closed intervals `[aStart, aEnd]` and `[bStart, bEnd]` are exactly adjacent:
 * one ends one unit before the other starts, so they share no value and leave no gap.
 *
 * The step is always taken DOWN from the later interval's start, never up from the earlier
 * interval's end. The later start is strictly greater than the earlier end, so it is never the
 * minimum value and the step cannot overflow. Stepping up from an end at the maximum value would
 * throw (`+275760-09-13`), and on a wrapping type it would silently wrap
 * (`PlainTime` `23:59:59.999999999 + 1 ns` is `00:00:00`).
 *
 * Callers own validation and reject reversed intervals before calling. `compare` must return a
 * negative, zero or positive number, like `Temporal.*.compare`.
 *
 * @example closedIntervalsAbut(1, 3, 4, 6, (x, y) => x - y, (x) => x - 1) // true
 * @example closedIntervalsAbut(4, 6, 1, 3, (x, y) => x - y, (x) => x - 1) // true
 * @example closedIntervalsAbut(1, 3, 5, 6, (x, y) => x - y, (x) => x - 1) // false (gap)
 * @example closedIntervalsAbut(1, 4, 4, 6, (x, y) => x - y, (x) => x - 1) // false (overlap)
 */
export function closedIntervalsAbut<T>(
  aStart: T,
  aEnd: T,
  bStart: T,
  bEnd: T,
  compare: (left: T, right: T) => number,
  stepDown: (value: T) => T,
): boolean {
  if (compare(aEnd, bStart) < 0 && compare(stepDown(bStart), aEnd) === 0) {
    return true;
  }

  return compare(bEnd, aStart) < 0 && compare(stepDown(aStart), bEnd) === 0;
}
