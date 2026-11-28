import { Temporal } from "../temporal";
import type { ResolvedRelativeTo } from "../resolveDurationRelativeTo";
import { isDurationCompareCompatNeeded } from "../temporalCompat";
import {
  add24HourDaysToTimeDuration,
  bigintSign,
  dateDurationDays,
  toInternalDuration,
} from "./operations";

/*
 * ---------------------------------------------------------------------------------------------
 * D35 — `Duration.compare` from a plain `relativeTo`
 * ---------------------------------------------------------------------------------------------
 * **A day or time amount whose date would be past the range throws** (D35,
 *    fullcalendar/temporal-polyfill#130). TC39 `Temporal.Duration.compare` adds only the years,
 *    months and weeks to a plain `relativeTo` (`DateDurationDays`), and compares the days and time
 *    as exact nanoseconds. Only their sum is range-checked, against `maxTimeDuration`
 *    (`Add24HourDaysToTimeDuration`). `temporal-polyfill` 1.0.8 adds the whole duration to the
 *    date, so `PT3000000000H` against `P1Y` from `2000-01-01` throws "Out-of-bounds date" where
 *    TC39 and Chromium 153 give 1, and `-P1D` against `P1W` from the first date throws where they
 *    give -1. Where the polyfill does not throw, its answer is TC39's. A zoned `relativeTo` adds
 *    the whole duration in TC39 too (`AddZonedDateTime`), and two durations with no year, month or
 *    week compare their days and time directly, so neither is reached.
 *    - Trigger: the runtime's `Temporal.Duration.compare` throws a `RangeError`, the D35 probe
 *      fails (`isDurationCompareCompatNeeded()`), the `relativeTo` is plain and a year, month or
 *      week is on either side. `durationCompare` then takes the spec path here, which throws
 *      again where TC39 throws.
 *    - Retired by: a temporal-polyfill release on which both D35 repros pass
 *      (fullcalendar/temporal-polyfill#130).
 *    - Removal: delete this file and its call in `durationCompare` and the D35 bullet in the
 *      header of `../zonedWallClockDifference.ts`; the D35 repros in
 *      `../temporalCompat/probeRepros.ts` (and `"D35"` in `DefectId`);
 *      `isDurationCompareCompatNeeded` in `../temporalCompat/capabilities.ts`, its export in
 *      `../temporalCompat/index.ts` and its tests; `dateDurationDays` and
 *      `add24HourDaysToTimeDuration` in `./operations.ts`, and the `export` on its `bigintSign`
 *      and `toInternalDuration`. Keep the rows in `duration/compare/compareDurations.test.ts`:
 *      their values are TC39's and hold either way.
 * ---------------------------------------------------------------------------------------------
 */

/** The date a plain `relativeTo` names, or `undefined` for a zoned one or none. */
function plainDateOf(
  relativeTo: ResolvedRelativeTo | undefined,
): Temporal.PlainDate | undefined {
  if (
    relativeTo === undefined ||
    relativeTo instanceof Temporal.ZonedDateTime
  ) {
    return undefined;
  }
  // A string is plain: `resolveDurationRelativeTo` reads every zoned one into a ZonedDateTime.
  if (typeof relativeTo === "string") {
    return Temporal.PlainDate.from(relativeTo);
  }
  return relativeTo instanceof Temporal.PlainDate
    ? relativeTo
    : relativeTo.toPlainDate();
}

function hasCalendarUnits(duration: Temporal.Duration): boolean {
  return duration.years !== 0 || duration.months !== 0 || duration.weeks !== 0;
}

/**
 * TC39 `Temporal.Duration.compare` from a plain `relativeTo` (D35), for a call on which the
 * runtime threw `error`: `DateDurationDays` for each side, then `Add24HourDaysToTimeDuration`.
 *
 * @returns -1, 0 or 1, or null to re-throw `error`: it is not a `RangeError`, neither side has a
 *   year, month or week, the `relativeTo` is zoned or absent, or the probe passes. Throws where
 *   TC39 throws
 */
export function compareFromPlainDate(
  error: unknown,
  one: Temporal.Duration,
  two: Temporal.Duration,
  relativeTo: ResolvedRelativeTo | undefined,
): number | null {
  if (
    !(error instanceof RangeError) ||
    !(hasCalendarUnits(one) || hasCalendarUnits(two)) ||
    !isDurationCompareCompatNeeded()
  ) {
    return null;
  }
  const plain = plainDateOf(relativeTo);
  if (plain === undefined) {
    return null;
  }
  const first = toInternalDuration(one);
  const second = toInternalDuration(two);
  return bigintSign(
    add24HourDaysToTimeDuration(
      first.time,
      dateDurationDays(first.date, plain),
    ) -
      add24HourDaysToTimeDuration(
        second.time,
        dateDurationDays(second.date, plain),
      ),
  );
}
