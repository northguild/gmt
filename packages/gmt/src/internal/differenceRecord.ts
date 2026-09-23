import type { Temporal } from "@js-temporal/polyfill";

/** Temporal's duration fields, largest first (Temporal Table 21, the unit ladder). */
const DURATION_FIELDS = [
  "years",
  "months",
  "weeks",
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
  "microseconds",
  "nanoseconds",
] as const;

/** A plural Temporal duration field name. */
export type DurationField = (typeof DURATION_FIELDS)[number];

/** How one Temporal type moves by a duration and measures the difference to another value. */
export interface DifferenceOperations<T> {
  add: (from: T, duration: Temporal.DurationLike) => T;
  until: (from: T, to: T, largestUnit: DurationField) => Temporal.Duration;
}

/** True when a field strictly between `larger` and `smaller` on the ladder has an amount. */
function hasAmountBetween(
  duration: Temporal.Duration,
  larger: DurationField,
  smaller: DurationField,
): boolean {
  const from = DURATION_FIELDS.indexOf(larger) + 1;
  const to = DURATION_FIELDS.indexOf(smaller);
  return DURATION_FIELDS.slice(from, to).some((field) => duration[field] !== 0);
}

/**
 * True when `unit` has to be measured again from the moved start: an unlisted unit above it (and
 * below the previous listed unit) has an amount, or `unit` is weeks in a duration whose largest
 * unit is larger than weeks. Temporal balances weeks only when `largestUnit` is weeks (TC39
 * Temporal DifferenceISODate: weeks are computed only for largestUnit "week"; for "month" and
 * "year" the remainder is days), so such a duration holds its weeks in `days`.
 */
function needsCarry(
  duration: Temporal.Duration,
  largest: DurationField,
  previous: DurationField,
  unit: DurationField,
): boolean {
  if (hasAmountBetween(duration, previous, unit)) return true;
  return unit === "weeks" && largest !== "weeks" && duration.days !== 0;
}

/**
 * Express a difference in exactly the listed units, so the record is the whole difference.
 *
 * `duration` is `start.until(end)` with `largestUnit` = the largest listed unit and the caller's
 * rounding options. Its fields are kept while the listed units are contiguous or every unlisted
 * unit between them is zero, so a single unit or adjacent units return Temporal's own fields.
 * When an unlisted unit between two listed units has an amount, that amount is carried into the
 * next smaller listed unit (and a listed `weeks` below months or years is measured afresh, because
 * Temporal leaves weeks in `days` unless `largestUnit` is weeks): the start is moved by the listed amounts found so far (one Temporal
 * `add`, which adds years and months before days), and the rest is measured from there to the
 * rounded end (`start.add(duration)`) with `largestUnit` = that listed unit. The record then
 * satisfies `start.add(record)` = `start.add(duration)`. Units smaller than the smallest listed
 * unit are dropped, as for a single unit.
 *
 * @param start the start value
 * @param duration the (rounded) difference from `start` with the largest listed unit
 * @param units the listed plural units, any order, non-empty
 * @param operations the type's `add` and `until`
 * @returns the amount of each listed unit, keyed by plural unit name in the order of `units`
 */
export function differenceRecord<T>(
  start: T,
  duration: Temporal.Duration,
  units: readonly DurationField[],
  operations: DifferenceOperations<T>,
): Record<DurationField, number> {
  const ordered = DURATION_FIELDS.filter((field) => units.includes(field));
  const amounts = {} as Record<DurationField, number>;
  let origin = start;
  let current = duration;
  let moved: Partial<Record<DurationField, number>> = {};
  let largest = ordered[0];
  let end: T | undefined;

  ordered.forEach((unit, index) => {
    const previous = ordered[index - 1];
    if (
      previous !== undefined &&
      largest !== undefined &&
      needsCarry(current, largest, previous, unit)
    ) {
      end ??= operations.add(start, duration);
      origin = operations.add(origin, moved);
      current = operations.until(origin, end, unit);
      largest = unit;
      moved = {};
    }
    amounts[unit] = current[unit];
    moved[unit] = current[unit];
  });

  // Keys follow the caller's order.
  return units.reduce(
    (record, unit) => {
      record[unit] = amounts[unit];
      return record;
    },
    {} as Record<DurationField, number>,
  );
}
