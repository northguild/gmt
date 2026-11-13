import { parseInstantNanoseconds } from "./instantNanoseconds";
import { isObject } from "./isObject";
import type { Interval } from "../types";

/** An `Interval` parsed once: bigint epoch nanoseconds plus the exact strings they came from. */
export interface IntervalNanoseconds {
  start: bigint;
  end: bigint;
  startText: string;
  endText: string;
}

/**
 * Parse a candidate `Interval` to epoch nanoseconds, or `null` when it is not one.
 *
 * - Any non-null object with ISO 8601 instant strings `start` ≤ `end` (by instant) is accepted;
 *   extra keys are ignored (GMT rule: the type is structural).
 * - Each endpoint is read exactly once, so the validated text is the text callers echo.
 *
 * @param value candidate `{ start, end }` record
 * @returns the parsed record, or null when `value` is not a valid `Interval`
 *
 * @example parseIntervalNanoseconds({ start: "1970-01-01T00:00:00Z", end: "1970-01-01T00:00:00.000000001Z" }) // { start: 0n, end: 1n, startText: "1970-01-01T00:00:00Z", endText: "1970-01-01T00:00:00.000000001Z" }
 * @example parseIntervalNanoseconds({ start: "1970-01-01T00:00:01Z", end: "1970-01-01T00:00:00Z" }) // null — inverted
 */
export function parseIntervalNanoseconds(
  value: unknown,
): IntervalNanoseconds | null {
  if (!isObject(value)) {
    return null;
  }

  const { start: startText, end: endText } = value as {
    start?: unknown;
    end?: unknown;
  };
  const start = parseInstantNanoseconds(startText as string);
  const end = parseInstantNanoseconds(endText as string);

  if (start === null || end === null || start > end) {
    return null;
  }

  return {
    start,
    end,
    startText: startText as string,
    endText: endText as string,
  };
}

/**
 * Parse a list of candidate `Interval`s, all-or-nothing.
 *
 * @param values candidate array of `{ start, end }` records
 * @returns the parsed records in input order, or null when `values` is not an array or any element is invalid
 *
 * @example parseIntervalNanosecondsList([]) // []
 * @example parseIntervalNanosecondsList([null]) // null
 */
export function parseIntervalNanosecondsList(
  values: unknown,
): IntervalNanoseconds[] | null {
  if (!Array.isArray(values)) {
    return null;
  }

  const records: IntervalNanoseconds[] = [];

  for (let index = 0; index < values.length; index++) {
    const record = parseIntervalNanoseconds(values[index]);

    if (record === null) {
      return null;
    }

    records.push(record);
  }

  return records;
}

/**
 * Sweep parsed intervals into sorted, disjoint, non-touching, non-empty runs.
 *
 * - Touching records coalesce (`start <= run.end`); a 1 ns gap does not.
 * - Equal starts keep input order (stable sort), so a run keeps its first start text; the first
 *   record to reach the run's latest end keeps its end text (GMT rule: first wins ties).
 * - Empty records that touch or fall inside a run are absorbed; a stranded one is dropped.
 * - Runs are copies; the input records are never mutated.
 *
 * @param records parsed intervals, in any order
 * @returns coalesced runs sorted by start
 *
 * @example coalesceIntervalNanoseconds([{ start: 3n, end: 5n, startText: "c", endText: "e" }, { start: 1n, end: 3n, startText: "a", endText: "c" }]) // [{ start: 1n, end: 5n, startText: "a", endText: "e" }]
 * @example coalesceIntervalNanoseconds([{ start: 4n, end: 4n, startText: "d", endText: "d" }]) // []
 */
export function coalesceIntervalNanoseconds(
  records: readonly IntervalNanoseconds[],
): IntervalNanoseconds[] {
  const sorted = [...records].sort((x, y) =>
    x.start < y.start ? -1 : x.start > y.start ? 1 : 0,
  );
  const runs: IntervalNanoseconds[] = [];

  for (const record of sorted) {
    const last = runs[runs.length - 1];

    if (last !== undefined && record.start <= last.end) {
      if (record.end > last.end) {
        last.end = record.end;
        last.endText = record.endText;
      }
    } else {
      runs.push({ ...record });
    }
  }

  return runs.filter((run) => run.start < run.end);
}

/**
 * The overlap of two parsed intervals, as the interval it spans. Never throws.
 *
 * @param first the first parsed interval
 * @param second the second parsed interval
 * @returns the shared span, or null when the two share no instant
 *
 * @example intersectIntervalRecords({ start: 1n, end: 5n, startText: "a", endText: "e" }, { start: 3n, end: 9n, startText: "c", endText: "i" }) // { start: "c", end: "e" }
 * @example intersectIntervalRecords({ start: 1n, end: 2n, startText: "a", endText: "b" }, { start: 2n, end: 3n, startText: "b", endText: "c" }) // null
 */
export function intersectIntervalRecords(
  first: IntervalNanoseconds,
  second: IntervalNanoseconds,
): Interval | null {
  if (!(first.start < second.end && second.start < first.end)) {
    return null;
  }

  return {
    start: first.start >= second.start ? first.startText : second.startText,
    end: first.end <= second.end ? first.endText : second.endText,
  };
}

/**
 * The core of `intersectIntervals`: the overlap of two intervals. Never throws.
 *
 * @returns what `intersectIntervals` returns, for the same arguments
 */
export function intersectIntervalPair(
  a: Interval,
  b: Interval,
): Interval | null {
  try {
    const first = parseIntervalNanoseconds(a);
    const second = parseIntervalNanoseconds(b);

    if (first === null || second === null) {
      return null;
    }

    return intersectIntervalRecords(first, second);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}

/**
 * The core of `mergeIntervals`: the union of a list of intervals as sorted, disjoint runs. Never throws.
 *
 * @returns what `mergeIntervals` returns, for the same arguments
 */
export function mergeIntervalList(intervals: Interval[]): Interval[] {
  try {
    const records = parseIntervalNanosecondsList(intervals);

    if (records === null) {
      return [];
    }

    return coalesceIntervalNanoseconds(records).map((run) => ({
      start: run.startText,
      end: run.endText,
    }));
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}

/**
 * The core of `intervalContains`: whether an interval holds an instant. Never throws.
 *
 * @returns what `intervalContains` returns, for the same arguments
 */
export function intervalContainsValue(
  interval: Interval,
  isoString: string,
): boolean {
  try {
    const record = parseIntervalNanoseconds(interval);
    const instant = parseInstantNanoseconds(isoString);

    if (record === null || instant === null) {
      return false;
    }

    return record.start <= instant && instant < record.end;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}

/**
 * An interval less a list of parsed removals, as the pieces left over. Never throws.
 *
 * @param source the parsed interval to cut from
 * @param removals the parsed intervals to remove, in any order
 * @returns the remaining pieces in order, empty when nothing is left
 *
 * @example subtractIntervalRecords({ start: 0n, end: 9n, startText: "a", endText: "i" }, [{ start: 3n, end: 5n, startText: "c", endText: "e" }]) // [{ start: "a", end: "c" }, { start: "e", end: "i" }]
 * @example subtractIntervalRecords({ start: 0n, end: 9n, startText: "a", endText: "i" }, [{ start: 0n, end: 9n, startText: "a", endText: "i" }]) // []
 */
export function subtractIntervalRecords(
  source: IntervalNanoseconds,
  removals: readonly IntervalNanoseconds[],
): Interval[] {
  const pieces: Interval[] = [];
  let cursor = source.start;
  let cursorText = source.startText;

  for (const removal of coalesceIntervalNanoseconds(removals)) {
    if (cursor >= source.end || removal.start >= source.end) {
      break;
    }

    if (removal.end <= cursor) {
      continue;
    }

    if (removal.start > cursor) {
      pieces.push({ start: cursorText, end: removal.startText });
    }

    cursor = removal.end;
    cursorText = removal.endText;
  }

  if (cursor < source.end) {
    pieces.push({ start: cursorText, end: source.endText });
  }

  return pieces;
}

/**
 * The core of `subtractIntervals`: an interval less a list of removals. Never throws.
 *
 * @returns what `subtractIntervals` returns, for the same arguments
 */
export function subtractIntervalList(
  from: Interval,
  remove: Interval[],
): Interval[] {
  try {
    const source = parseIntervalNanoseconds(from);
    const removals = parseIntervalNanosecondsList(remove);

    if (source === null || removals === null) {
      return [];
    }

    return subtractIntervalRecords(source, removals);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}

/**
 * Whether two parsed intervals share an instant.
 *
 * @param first the first parsed interval
 * @param second the second parsed interval
 * @returns true when the half-open spans overlap
 *
 * @example intervalRecordsOverlap({ start: 1n, end: 5n, startText: "a", endText: "e" }, { start: 3n, end: 9n, startText: "c", endText: "i" }) // true
 * @example intervalRecordsOverlap({ start: 1n, end: 2n, startText: "a", endText: "b" }, { start: 2n, end: 3n, startText: "b", endText: "c" }) // false
 */
export function intervalRecordsOverlap(
  first: IntervalNanoseconds,
  second: IntervalNanoseconds,
): boolean {
  return first.start < second.end && second.start < first.end;
}

/**
 * The core of `intervalsOverlap`: whether two intervals share an instant. Never throws.
 *
 * @returns what `intervalsOverlap` returns, for the same arguments
 */
export function intervalPairOverlaps(a: Interval, b: Interval): boolean {
  try {
    const first = parseIntervalNanoseconds(a);
    const second = parseIntervalNanoseconds(b);

    if (first === null || second === null) {
      return false;
    }

    return intervalRecordsOverlap(first, second);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return false;
  }
}
