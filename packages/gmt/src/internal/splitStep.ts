import type { Temporal } from "@js-temporal/polyfill";

const EXACT_DURATION_UNITS: ReadonlySet<string> = new Set([
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
  "microseconds",
  "nanoseconds",
]);

/**
 * Consecutive split steps allowed to resolve to the previous boundary before a split gives up.
 *
 * A deleted local day costs one skipped step; the cap only stops a zone (or a stub) that never
 * advances from looping forever.
 */
export const MAX_STALLED_SPLIT_STEPS = 8;

/**
 * Whether a plural duration unit is an exact time unit (hours and smaller).
 *
 * - Exact units never clamp, so split functions step them from the previous boundary.
 * - Calendar units (`years`, `months`, `weeks`, `days`) return `false` and stay anchored to the
 *   interval start.
 *
 * @param unit plural duration unit, as returned by `resolveDurationUnit`
 * @returns `true` for `hours` through `nanoseconds`, otherwise `false`
 *
 * @example isExactDurationUnit("hours") // true
 * @example isExactDurationUnit("days") // false
 * @example isExactDurationUnit("hour") // false
 */
export function isExactDurationUnit(unit: string): boolean {
  return EXACT_DURATION_UNITS.has(unit);
}

/**
 * Tile `[start, end)` into `amount × unit` steps for one Temporal type.
 *
 * - Calendar units are anchored: boundary k is `start.add({ [unit]: amount × k })`, so month-end
 *   starts don't drift.
 * - Exact units step from the previous boundary (`previous.add({ [unit]: amount })`), which never
 *   clamps and avoids `amount × k` passing `Number.MAX_SAFE_INTEGER`.
 * - A step equal to the previous boundary is skipped (a deleted local day); more than
 *   `MAX_STALLED_SPLIT_STEPS` in a row returns `null`.
 * - A step that goes backwards returns `null`.
 * - The last slice's end is trimmed to `end`. Callers handle `start >= end` before calling.
 *
 * Generic over the value type only — each caller passes its own Temporal type and comparator, so
 * plain, zoned and instant values are never mixed.
 *
 * @param start interval start
 * @param end interval end, strictly after `start`
 * @param compare the Temporal type's `compare`
 * @param unit plural duration unit
 * @param amount positive number of units per step
 * @returns `[sliceStart, sliceEnd]` pairs, or `null` when stepping goes backwards or stalls
 *
 * @example tileByUnit(Temporal.PlainDate.from("2024-01-01"), Temporal.PlainDate.from("2024-01-04"), Temporal.PlainDate.compare, "days", 2) // [[2024-01-01, 2024-01-03], [2024-01-03, 2024-01-04]]
 * @example tileByUnit(Temporal.PlainDate.from("2024-01-01"), Temporal.PlainDate.from("2024-01-04"), Temporal.PlainDate.compare, "hours", 1) // null (PlainDate ignores hours, so no step advances)
 */
export function tileByUnit<
  T extends { add(duration: Temporal.DurationLike): T },
>(
  start: T,
  end: T,
  compare: (a: T, b: T) => number,
  unit: string,
  amount: number,
): Array<[T, T]> | null {
  const exact = isExactDurationUnit(unit);
  const slices: Array<[T, T]> = [];

  for (
    let step = 1, stalled = 0, current = start;
    compare(current, end) < 0;
    step++
  ) {
    const next = exact
      ? current.add({ [unit]: amount })
      : start.add({ [unit]: amount * step });
    const order = compare(next, current);

    if (order < 0) {
      return null;
    }

    if (order === 0) {
      stalled++;
      if (stalled > MAX_STALLED_SPLIT_STEPS) {
        return null;
      }
      continue;
    }

    stalled = 0;
    slices.push([current, compare(next, end) > 0 ? end : next]);
    current = next;
  }

  return slices;
}
