import { Temporal } from "../temporal";
import {
  MAX_EPOCH_NANOSECONDS,
  MIN_EPOCH_NANOSECONDS,
} from "../epochNanoseconds";
import { isNamedTimeZone } from "../zonedWallClock";
import {
  NANOSECONDS_PER_DAY,
  NANOSECONDS_PER_TIME_UNIT,
  bigintAbs,
  toInternalDuration,
} from "./operations";
import type { RoundingSettings, Unit } from "./operations";
import { checkUtcValidity } from "./utcValidity";

/*
 * ---------------------------------------------------------------------------------------------
 * Defect 1 — wall-clock clamp at the range limits (zoned.A)
 * ---------------------------------------------------------------------------------------------
 * 1. **Wall-clock clamp** (defect 1 in `../zonedWallClock.ts`). In a named zone the polyfill throws
 *    `RangeError` for a wall clock whose UTC reading is past a limit although its exact time is
 *    in range, so e.g. `(max − 1 d).until(max, { largestUnit: "day" })` throws in Australia/Sydney
 *    where TC39 returns `P1D`. The same wrong clamp, plus a `CheckISODaysRange` the spec does not
 *    have, rejects the local dates of the minimum instant in zones behind UTC.
 *    - Trigger: the polyfill throws, the zone is a named non-UTC zone, and the operation reaches a
 *      limit. The TC39 result is then recomputed from the abstract operations mirrored in `./operations.ts`.
 *    - Retired by: at the maximum, polyfill commit 05ce7a3 ("Correctly handle limits in
 *      GetNamedTimeZoneEpochNanoseconds") once a release containing it is GMT's dependency floor.
 *      At the minimum, no upstream fix yet: a 0.5.1 build with 05ce7a3 applied still throws for
 *      the minimum-instant rows in `zonedWallClockDifference.test.ts` (New York, Honolulu).
 *    - Removal: once a polyfill release passes every row in `zonedWallClockDifference.test.ts`
 *      with the fallbacks disabled, replace the try/catch in `runAtRangeLimit` with
 *      `const result = compute(timeZone);`, drop its `fallback` parameter, and delete the four
 *      `() => …AtLimit(…)` arguments in `../zonedWallClockDifference.ts`. `untilAtLimit` is also
 *      called by the `// defects 3–5` block in `zonedUntil`, and `totalAtLimit`, `roundAtLimit` and
 *      `compareAtLimit` by `./calendarArithmetic.ts`, `./nudgeWindow.ts` and `./nudgeOrigin.ts`.
 *      Delete the four `*AtLimit` functions in `./operations.ts` only once none of those calls
 *      them. With defect 2 also gone, delete this file, the reach code and `atRangeLimit`; each
 *      wrapper returns its plain polyfill call. Then drop the imports and locals tsc reports unused, and the `./operations.ts`
 *      exports fallow reports unused.
 *
 * `UNIT_REACH` and the reach helpers decide whether an operation is near a limit; defect 2 uses
 * the same decision.
 * ---------------------------------------------------------------------------------------------
 */

/** Upper bound on one unit's exact length in any zone: 366-day years, 31-day months, 2-day days. */
export const UNIT_REACH: Record<Unit, bigint> = {
  year: 366n * NANOSECONDS_PER_DAY,
  month: 31n * NANOSECONDS_PER_DAY,
  week: 7n * NANOSECONDS_PER_DAY,
  day: 2n * NANOSECONDS_PER_DAY,
  ...NANOSECONDS_PER_TIME_UNIT,
};

/** A wall clock lies within a day of its exact time, and the offset probes look one day further. */
const LIMIT_MARGIN = 2n * NANOSECONDS_PER_DAY;

/** True when `epochs`, widened by `reach` and the limit margin, touch either range limit. */
export function reachesRangeLimit(
  epochs: readonly bigint[],
  reach: bigint,
): boolean {
  const widen = reach + LIMIT_MARGIN;
  return epochs.some(
    (epoch) =>
      epoch - widen <= MIN_EPOCH_NANOSECONDS ||
      epoch + widen >= MAX_EPOCH_NANOSECONDS,
  );
}

/** An upper bound on how far `duration` moves an exact time in any zone. */
export function durationReach(duration: Temporal.Duration): bigint {
  const { date, time } = toInternalDuration(duration);
  return (
    BigInt(Math.abs(date.years)) * UNIT_REACH.year +
    BigInt(Math.abs(date.months)) * UNIT_REACH.month +
    BigInt(Math.abs(date.weeks)) * UNIT_REACH.week +
    BigInt(Math.abs(date.days)) * UNIT_REACH.day +
    bigintAbs(time)
  );
}

/** How far rounding can look past its destination: one increment, then bubbling to `largestUnit`. */
export function roundingReach(settings: RoundingSettings): bigint {
  const increment = Number.isSafeInteger(settings.increment)
    ? Math.abs(settings.increment)
    : 1;
  return (
    UNIT_REACH[settings.largestUnit] +
    BigInt(Math.max(increment, 1)) * UNIT_REACH[settings.smallestUnit]
  );
}

/**
 * Returns `compute(timeZone)`, the polyfill's own result, unchanged. Near a range limit only:
 * a UTC result is checked with `checkUtcValidity` (defect 2), and a named zone's error is
 * replaced by `fallback`'s TC39 result when it has one (defect 1).
 */
export function runAtRangeLimit<T>(
  timeZone: string,
  atRangeLimit: boolean,
  compute: (timeZone: string) => T,
  fallback: () => T | null,
): T {
  let result: T;
  try {
    result = compute(timeZone);
  } catch (error) {
    if (!atRangeLimit || !isNamedTimeZone(timeZone)) throw error;
    const recovered = fallback();
    if (recovered === null) throw error;
    return recovered;
  }

  if (atRangeLimit && timeZone === "UTC") {
    // defect 2
    checkUtcValidity(compute);
  }
  return result;
}
