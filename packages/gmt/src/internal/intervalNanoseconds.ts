import { parseInstantNanoseconds } from "./instantNanoseconds";

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
  if (typeof value !== "object" || value === null) {
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
