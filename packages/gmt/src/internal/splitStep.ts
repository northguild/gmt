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
 * - More than `maxSlices` slices returns `null` as soon as the next one is due, so the work stays
 *   bounded by the limit (owner decision A2, CORE-8).
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
 * @param maxSlices most slices to build; one more returns `null` before it is built
 * @param add how a duration is added to a value (default `value.add(duration)`; the plain date
 *   caller passes its calendar-correct add)
 * @returns `[sliceStart, sliceEnd]` pairs, or `null` when stepping goes backwards, stalls, or
 *   would build more than `maxSlices`
 *
 * @example tileByUnit(Temporal.PlainDate.from("2024-01-01"), Temporal.PlainDate.from("2024-01-04"), Temporal.PlainDate.compare, "days", 2, 100) // [[2024-01-01, 2024-01-03], [2024-01-03, 2024-01-04]]
 * @example tileByUnit(Temporal.PlainDate.from("2024-01-01"), Temporal.PlainDate.from("2024-01-04"), Temporal.PlainDate.compare, "hours", 1, 100) // null (PlainDate ignores hours, so no step advances)
 */
export function tileByUnit<
  T extends { add(duration: Temporal.DurationLike): T },
>(
  start: T,
  end: T,
  compare: (a: T, b: T) => number,
  unit: string,
  amount: number,
  maxSlices: number,
  add: (value: T, duration: Temporal.DurationLike) => T = (value, duration) =>
    value.add(duration),
): Array<[T, T]> | null {
  const exact = isExactDurationUnit(unit);
  const slices: Array<[T, T]> = [];

  for (
    let step = 1, stalled = 0, current = start;
    compare(current, end) < 0;
    step++
  ) {
    const next = exact
      ? add(current, { [unit]: amount })
      : add(start, { [unit]: amount * step });
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

    if (slices.length === maxSlices) {
      return null;
    }

    slices.push([current, compare(next, end) > 0 ? end : next]);
    current = next;
  }

  return slices;
}

const NANOSECONDS_PER_DAY = 86_400_000_000_000;

/**
 * The longest a single unit can be, in nanoseconds.
 *
 * Exact units are fixed. A calendar month is at most 31 days in every CLDR calendar, and a
 * calendar year at most 385 days (a Hebrew or Chinese leap year).
 */
const LONGEST_UNIT_NANOSECONDS: Readonly<Record<string, number>> = {
  nanoseconds: 1,
  microseconds: 1_000,
  milliseconds: 1_000_000,
  seconds: 1_000_000_000,
  minutes: 60_000_000_000,
  hours: 3_600_000_000_000,
  days: NANOSECONDS_PER_DAY,
  weeks: 7 * NANOSECONDS_PER_DAY,
  months: 31 * NANOSECONDS_PER_DAY,
  years: 385 * NANOSECONDS_PER_DAY,
};

/**
 * A zoned boundary can sit this far from its wall-clock distance: a UTC offset lies strictly
 * within ±24 hours (Temporal IsOffsetTimeZoneIdentifier / ECMA-262 time zone offset range), so
 * two offsets differ by less than 48 hours.
 */
const ZONE_OFFSET_SLACK_NANOSECONDS = 2 * NANOSECONDS_PER_DAY;

/**
 * Guards the floating-point quotient so a lower bound is never rounded above the true count: the
 * span, the step and their quotient each carry at most half an ulp of rounding error.
 */
const QUOTIENT_TOLERANCE = 1 - 8 * Number.EPSILON;

/**
 * A lower bound on the number of slices `tileByUnit` returns for a span, without stepping.
 *
 * - Exact units (hours and smaller) never clamp or stall: the bound is `ceil(span / step)`.
 * - Calendar units step at most `amount ×` the longest unit, so reaching `end` takes at least
 *   `ceil(span / longest step)` steps.
 * - `zoned` values may also shift by an offset change (under 48 hours) and may stall up to
 *   `MAX_STALLED_SPLIT_STEPS` steps in a row, so only one step in `MAX_STALLED_SPLIT_STEPS + 1`
 *   is guaranteed to be a slice.
 * - Callers compare the bound with `maxPieces` to return the sentinel before building a huge split;
 *   `tileByUnit`'s own `maxSlices` settles counts the bound cannot.
 *
 * @param spanNs exact span between start and end, in nanoseconds
 * @param unit plural duration unit, as returned by `resolveDurationUnit`
 * @param amount units per step
 * @param zoned whether the values carry a time zone with offset transitions
 * @returns a count no greater than the slices `tileByUnit` would build (0 when unknown)
 *
 * @example minSlicesForSpan(3 * 3_600_000_000_000, "hours", 1, false) // 3
 * @example minSlicesForSpan(62 * 86_400_000_000_000, "months", 1, false) // 2
 */
export function minSlicesForSpan(
  spanNs: number,
  unit: string,
  amount: number,
  zoned: boolean,
): number {
  const longest = LONGEST_UNIT_NANOSECONDS[unit];

  if (longest === undefined || !(amount > 0)) {
    return 0;
  }

  const stepNs = longest * amount;

  if (isExactDurationUnit(unit)) {
    return Math.ceil((spanNs / stepNs) * QUOTIENT_TOLERANCE);
  }

  const reach = Math.max(
    0,
    spanNs - (zoned ? ZONE_OFFSET_SLACK_NANOSECONDS : 0),
  );
  const steps = Math.ceil((reach / stepNs) * QUOTIENT_TOLERANCE);

  return zoned ? Math.floor(steps / (MAX_STALLED_SPLIT_STEPS + 1)) : steps;
}
