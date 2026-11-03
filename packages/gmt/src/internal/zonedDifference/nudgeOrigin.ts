import { Temporal } from "../temporal";
import { isNudgeOriginCompatNeeded } from "../temporalCompat";
import { isNamedTimeZone, possibleEpochNanoseconds } from "../zonedWallClock";
import {
  atTimeOf,
  isDateUnit,
  isoDateTimeFor,
  roundAtLimit,
  totalAtLimit,
} from "./operations";
import type {
  DurationRoundOptions,
  RoundingSettings,
  Unit,
} from "./operations";

/*
 * ---------------------------------------------------------------------------------------------
 * Defect 5 — an origin in a repeated hour is measured from the wrong instant (D22)
 * ---------------------------------------------------------------------------------------------
 * 5. **An origin in a repeated hour is measured from the wrong instant** (D22). A zoned `relativeTo`
 *    or start can name either pass of a repeated hour. TC39 `ComputeNudgeWindow` takes the window's
 *    start from the origin's own exact time when no date unit has been added (tc39/ecma262#3759,
 *    commit `1f4e6717ef23`), and `DifferenceZonedDateTime` subtracts the exact times when both fall
 *    on one local date. The polyfill does neither, and turns the wall clock back into an exact time
 *    with `"compatible"`, which takes the earlier pass. Each pass goes wrong its own way:
 *    - From the later pass the answer is measured from an hour before the instant the caller named.
 *      `PT0S` from `2024-11-03T01:30:00-05:00[America/New_York]` totals 0.04 days where TC39 and
 *      Chromium 153 give 0, `PT11H45M` rounds to `P1D` where they give `PT0S`, and `PT1H` in days and
 *      hours reads `PT2H` where they give `PT1H`.
 *    - From the earlier pass, an end in the later pass at a lower wall clock falls on the same date,
 *      and the polyfill backs up a day to reach it. `PT30M` from
 *      `2024-11-03T01:30:00-04:00[America/New_York]` totals 0.0208 days where they give 0.02, rounds
 *      to `-P2D` in days where they give `PT0S`, and `until` the same end throws where they give
 *      `PT30M`.
 *    - Some lengths have no spec value at all, and the polyfill extrapolates one, because its release
 *      builds strip `assert`. Each Assert in `./operations.ts` names the tc39/proposal-temporal issue that asks what
 *      should happen. **GMT's decision: where the Assert fails, the operations in `./operations.ts` throw, so the public
 *      function returns its sentinel: `null` for a number, `""` for a string. It never
 *      extrapolates.** Four Asserts are reached:
 *      - `NudgeToCalendarUnit` (#3336), when the target is outside the window after the second
 *        `ComputeNudgeWindow`. The shift only moves a month or a year, so a day or a week cannot be
 *        rescued. `PT24H30M` from `2024-11-02T01:30:00-04:00[America/New_York]` in days: the end
 *        bound resolves to the earlier pass, 30 minutes short of the target. Polyfill 1.0208; weeks
 *        and months stay inside their windows and keep their values. The mirror is a gap: `-PT23H20M`
 *        from `2024-03-11T02:30:00-04:00` in days, where the end bound moves forward past the target.
 *      - `CombineDateAndTimeDuration` (#3311), when the signs disagree. `PT15M` from
 *        `1944-10-01T00:00:59-06:00[America/Phoenix]` ends on the date before, in every date unit.
 *      - `DifferenceZonedDateTime` (#3311), when the day corrections run out. `-PT15M` from
 *        `1944-10-01T00:00:59-07:00[America/Phoenix]`. Chromium 153 reads `PT45M` here without a
 *        smallestUnit, the wrong sign; GMT returns its sentinel.
 *      - `NudgeToZonedTime` (#3310), when the day span is empty. A skipped day ends the span where
 *        it starts: `-PT43199S` from `1995-01-01T12:00:00+13:00[Pacific/Enderbury]` with
 *        `largestUnit: "day"` and `smallestUnit: "minute"`. The polyfill throws too. Chromium 153
 *        reads `-P1DT12H` for 12 hours.
 *      Only a `smallestUnit` or a total builds a window, so `until` without one keeps the bare
 *      difference: `PT24H30M` above. `until` and `since` both measure from their receiver, and every
 *      GMT difference passes its first argument as the receiver, so swapping the arguments can move a
 *      length back inside its window and give it a value.
 *    It reaches `Duration#total` in a date unit, and `Duration#round` and `until` with a date
 *    `largestUnit`. `Duration.compare` builds no window, and time units are plain subtraction, so
 *    neither is reached.
 *    - Trigger: `isNudgeOriginCompatNeeded()` — the D22 probe fails — with a date unit and
 *      `originNeedsSpecPath`: the origin or the target names two instants, or the target is earlier
 *      and a window's end bound falls in a gap. The operation then takes the spec path in `./operations.ts`.
 *    - Retired by: a js-temporal release containing `3c403686d39` ("fix for issues #3141, #3148 and
 *      #3149", on `main`). That release must also carry tc39/proposal-temporal#3319, or `P7D` with
 *      `largestUnit: "week"` regresses to `P1W1D`: `3c403686d39` tests `r1 = 0`, where #3319 and
 *      tc39/ecma262#3759 test for an empty date duration, which is what `computeNudgeWindow` in `./operations.ts`
 *      does. It must also give no value for every read in `totalsWithNoValue`, `noDayCorrection`
 *      and `emptyDaySpan`. `main`'s Asserts are written (`lib/ecmascript.ts`, read, not run) and
 *      `rollup.config.js` strips them from a production build, so a release built that way fails
 *      those repros and this stays. They are samples, not proof: `test/noSpecValue.test.ts` must
 *      also pass on the release. Removing it earlier would turn the sentinels back into numbers.
 *    - Removal: delete this file and its three calls in `../zonedWallClockDifference.ts` (the
 *      `originTotalBySpec` and `originRoundBySpec` operands in `durationTotal` and `durationRound`,
 *      and the defect 5 term in `untilTakesSpecPath`), the D22 rows in
 *      `../temporalCompat/probeRepros.ts`, and the export of `possibleEpochNanoseconds` from
 *      `../zonedWallClock.ts`. Keep the throws in `./operations.ts`: they are this port's own
 *      Asserts. The last of defects 3–5 to go also deletes `untilTakesSpecPath`, the
 *      `// defects 3–5` block in `zonedUntil` that calls `untilAtLimit`, and the `bySpec` blocks in
 *      `durationTotal` and `durationRound`. Then drop the imports and locals tsc reports unused, and
 *      the `./operations.ts` exports fallow reports unused.
 * ---------------------------------------------------------------------------------------------
 */

/**
 * True when a length from `zoned` must take the spec path (defect 5): the runtime would mismeasure
 * it, or the specification has no value for it. `length` is the target's exact time, or a duration
 * to add to `zoned`. At most four wall-clock resolutions, and no loop.
 *
 * - `zoned` is either pass of a repeated wall clock, which the runtime mismeasures.
 * - `target` is. A forward window's end bound can only fall short of the target when its nominal wall
 *   clock is past the target's and its exact time is before it, so a backward transition lies between
 *   them and the target's wall clock repeats. A date difference that disagrees in sign needs the same.
 * - `target` is earlier, and the window's end bound is in a gap. Its nominal wall clock is at or
 *   before the target's, and `"compatible"` moves it forward past the target. The bound falls at
 *   the origin's time of day, on the target's date or the one before it, as a gap is at most 24 hours.
 *
 * An addition that throws, or a wall clock that cannot be resolved near a range limit, is left to the
 * range-limit fallbacks.
 */
export function originNeedsSpecPath(
  zoned: Temporal.ZonedDateTime,
  length: bigint | Temporal.Duration,
): boolean {
  const timeZone = zoned.timeZoneId;
  if (!isNamedTimeZone(timeZone) || !isNudgeOriginCompatNeeded()) {
    return false;
  }
  try {
    const target =
      typeof length === "bigint" ? length : zoned.add(length).epochNanoseconds;
    const start = isoDateTimeFor(timeZone, zoned.epochNanoseconds);
    const end = isoDateTimeFor(timeZone, target);
    if (
      possibleEpochNanoseconds(timeZone, start).length > 1 ||
      possibleEpochNanoseconds(timeZone, end).length > 1
    ) {
      return true;
    }
    if (target >= zoned.epochNanoseconds) return false;
    const endDate = end.toPlainDate();
    return [endDate, endDate.subtract({ days: 1 })].some(
      (date) =>
        possibleEpochNanoseconds(timeZone, atTimeOf(date, start)).length === 0,
    );
  } catch {
    return false;
  }
}

/**
 * Defect 5: `Duration#total` by the spec when `originNeedsSpecPath` holds. Time units subtract exact
 * times, so only a date unit can reach it. Where the specification has no value this throws.
 */
export function originTotalBySpec(
  duration: Temporal.Duration,
  unitOption: string,
  unit: Unit,
  zoned: Temporal.ZonedDateTime | null,
): number | null {
  return zoned !== null &&
    isDateUnit(unit) &&
    originNeedsSpecPath(zoned, duration)
    ? totalAtLimit(duration, zoned, unitOption, unit)
    : null;
}

/**
 * Defect 5: `Duration#round` by the spec when `originNeedsSpecPath` holds. The `largestUnit` decides:
 * a date one builds a date difference even when `smallestUnit` is an hour. Where the specification
 * has no value this throws.
 */
export function originRoundBySpec(
  duration: Temporal.Duration,
  roundTo: DurationRoundOptions,
  settings: RoundingSettings,
  zoned: Temporal.ZonedDateTime | null,
): Temporal.Duration | null {
  return zoned !== null &&
    isDateUnit(settings.largestUnit) &&
    originNeedsSpecPath(zoned, duration)
    ? roundAtLimit(duration, zoned, roundTo, settings)
    : null;
}
