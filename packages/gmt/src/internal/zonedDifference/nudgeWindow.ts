import { Temporal } from "../temporal";
import type { DurationRelativeTo } from "../../types";
import { isNudgeWindowCompatNeeded } from "../temporalCompat";
import { isObject } from "../isObject";
import {
  differencePlainDateTimeWithRounding,
  isDateUnit,
  largerUnit,
  optionsAreValid,
  roundAtLimit,
  roundWithPlainRelativeTo,
  roundingSettings,
  temporalDurationFromInternal,
  timeZoneAnnotation,
  totalAtLimit,
  totalWithPlainRelativeTo,
} from "./operations";
import type {
  DurationRoundOptions,
  RoundingSettings,
  TimeUnit,
  Unit,
} from "./operations";

/*
 * ---------------------------------------------------------------------------------------------
 * Defect 4 — the calendar nudge window is never retried (D11)
 * ---------------------------------------------------------------------------------------------
 * 4. **The calendar nudge window is never retried** (D11). TC39 bounds a duration between
 *    `relativeTo + r1 units` and `relativeTo + r2 units`, taken from the duration's own count of
 *    that unit, and `NudgeToCalendarUnit` then checks that the target falls inside that window; when
 *    it does not, `ComputeNudgeWindow` runs again with `additionalShift`, so `r1` becomes 1 rather
 *    than 0. The polyfill computes the window once and never retries — its own
 *    `assert(start <= dest <= end)` is compiled out of production builds — so the answer is taken
 *    over bounds that do not contain the target. It reaches `Duration#total` (a wrong fraction:
 *    2024-01-31 to 2024-02-29T12:00 totals 1.0172413793103448 months where TC39 and Chromium 153
 *    give 1.0161290322580645), `Duration#round` and `until`/`since` with a calendar `smallestUnit`
 *    (a whole unit: the same span truncates to `PT0S` instead of `P1M`). Only a `relativeTo` or
 *    start past the 28th can reach it, because only there does adding a month constrain the day.
 *    - Trigger: `isNudgeWindowCompatNeeded()` — the D11 probe fails — with a "month" or "year" unit
 *      and a `relativeTo` on the 29th, 30th or 31st. The operation then takes the spec path in `./operations.ts`,
 *      the same `nudgeToCalendarUnit` the non-ISO calendars already use.
 *    - Retired by: a js-temporal release containing a port of proposal-temporal #3172
 *      (`17e12be0af42`, merged 2025-11-19), which is the fix for tc39/proposal-temporal#3168. The
 *      port is on js-temporal `main` as `5af905fc1fa`, in no release yet.
 *    - Removal: delete this file and its calls in `../zonedWallClockDifference.ts` (the
 *      `monthTotalBySpec` and `monthRoundBySpec` operands in `durationTotal` and `durationRound`, the
 *      defect-4 term in `untilTakesSpecPath`, and the `plainUntilWithRounding` re-export), the
 *      `plainUntilWithRounding` export in `../index.ts`, and the D11 rows in
 *      `../temporalCompat/probeRepros.ts`. `plain/calculate/diffDateTime.ts` then calls
 *      `dt1.until(dt2, options)` again, which is the call `plainUntilWithRounding` already makes when
 *      the defect cannot apply. Keep the `progress === 0n` branch in `nudgeToCalendarUnit`
 *      (`./operations.ts`): that is GMT's own bug, not the polyfill's. The last of defects 3–5 to go also deletes `untilTakesSpecPath`, the
 *      `// defects 3–5` block in `zonedUntil` that calls `untilAtLimit`, and the `bySpec` blocks in
 *      `durationTotal` and `durationRound`. Then drop the imports and locals tsc reports unused, and
 *      the `./operations.ts` exports fallow reports unused.
 * ---------------------------------------------------------------------------------------------
 */

const PLAIN_DATE_TIME_PROBE = new Temporal.PlainDateTime(2000, 1, 1);

/**
 * Units whose nudge window can miss its target: only a month, or a year that carries months with it.
 * A week or a day is a fixed count of days, so `relativeTo + r1 units` never has to constrain.
 */
export function isNudgeWindowUnit(unit: Unit | undefined): boolean {
  return unit === "month" || unit === "year";
}

/**
 * The day of month a `relativeTo` resolves to, or 0 when there is none to read.
 *
 * Only the 29th, 30th and 31st can reach defect 4: below that, adding a month never constrains
 * the day, so the two denominators coincide and the polyfill's answer is already the spec's.
 */
function relativeToDayOfMonth(
  relativeTo: DurationRelativeTo | undefined,
  zoned: Temporal.ZonedDateTime | null,
): number {
  if (zoned !== null) {
    return zoned.day;
  }
  try {
    if (relativeTo instanceof Temporal.PlainDateTime) {
      return relativeTo.day;
    }
    if (relativeTo instanceof Temporal.PlainDate) {
      return relativeTo.day;
    }
    if (typeof relativeTo === "string") {
      return Temporal.PlainDate.from(relativeTo).day;
    }
    if (isObject(relativeTo)) {
      return Temporal.PlainDate.from(relativeTo as never).day;
    }
  } catch {
    return 0;
  }
  return 0;
}

/** The plain `relativeTo` Temporal would resolve, whatever its calendar, or null. */
function plainRelativeTo(
  relativeTo: DurationRelativeTo | undefined,
): Temporal.PlainDate | null {
  try {
    if (relativeTo instanceof Temporal.PlainDate) {
      return relativeTo;
    }
    if (relativeTo instanceof Temporal.PlainDateTime) {
      return relativeTo.toPlainDate();
    }
    if (
      typeof relativeTo === "string" &&
      !timeZoneAnnotation.test(relativeTo)
    ) {
      return Temporal.PlainDate.from(relativeTo);
    }
    if (
      isObject(relativeTo) &&
      !(relativeTo instanceof Temporal.ZonedDateTime)
    ) {
      return Temporal.PlainDate.from(relativeTo as never);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Defect 4: `Duration#total` by the spec when the polyfill would divide the month fraction by the
 * wrong month. Returns null whenever the defect cannot apply, leaving the polyfill's own answer.
 */
export function monthTotalBySpec(
  duration: Temporal.Duration,
  unitOption: string,
  unit: Unit,
  relativeTo: DurationRelativeTo | undefined,
  zoned: Temporal.ZonedDateTime | null,
): number | null {
  if (
    !isNudgeWindowUnit(unit) ||
    relativeToDayOfMonth(relativeTo, zoned) < 29 ||
    !isNudgeWindowCompatNeeded()
  ) {
    return null;
  }
  if (zoned !== null) {
    return totalAtLimit(duration, zoned, unitOption, unit);
  }
  const plain = plainRelativeTo(relativeTo);
  return plain === null
    ? null
    : totalWithPlainRelativeTo(duration, plain, unitOption, unit);
}

/**
 * Defect 4: `Duration#round` by the spec when the polyfill would round over a nudge window that
 * does not contain the target. Returns null whenever the defect cannot apply, leaving the
 * polyfill's own answer.
 */
export function monthRoundBySpec(
  duration: Temporal.Duration,
  roundTo: DurationRoundOptions,
  settings: RoundingSettings,
  zoned: Temporal.ZonedDateTime | null,
): Temporal.Duration | null {
  if (
    !isNudgeWindowUnit(settings.smallestUnit) ||
    relativeToDayOfMonth(roundTo.relativeTo, zoned) < 29 ||
    !isNudgeWindowCompatNeeded()
  ) {
    return null;
  }
  if (zoned !== null) {
    return roundAtLimit(duration, zoned, roundTo, settings);
  }
  const plain = plainRelativeTo(roundTo.relativeTo);
  return plain === null
    ? null
    : roundWithPlainRelativeTo(duration, plain, roundTo, settings);
}

/**
 * `PlainDateTime#until` / `#since`, correct when the polyfill would round over a nudge window that
 * does not contain the target (defect 4).
 *
 * The plain difference functions round through the polyfill directly, because neither the range
 * limits nor the non-ISO calendars reach them the way they reach the zoned ones. A calendar
 * `smallestUnit` measured from a day that a month add would constrain is the one case that does, so
 * it takes the spec path and everything else stays the polyfill's own call.
 *
 * @param one the earlier plain datetime
 * @param two the later plain datetime
 * @param options Temporal difference options, passed through unchanged when the defect cannot apply
 * @returns the difference; throws where TC39 Temporal throws
 */
export function plainUntilWithRounding(
  one: Temporal.PlainDateTime,
  two: Temporal.PlainDateTime,
  options: {
    largestUnit?: unknown;
    smallestUnit?: unknown;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
  } = {},
): Temporal.Duration {
  const settings = roundingSettings(
    options.largestUnit,
    options.smallestUnit,
    (smallestUnit) => largerUnit("hour", smallestUnit),
    options.roundingIncrement,
    options.roundingMode ?? "trunc",
  );

  if (
    settings !== null &&
    isNudgeWindowUnit(settings.smallestUnit) &&
    one.day >= 29 &&
    one.calendarId === two.calendarId &&
    Temporal.PlainDateTime.compare(one, two) <= 0 &&
    isNudgeWindowCompatNeeded() &&
    optionsAreValid(() =>
      PLAIN_DATE_TIME_PROBE.until(PLAIN_DATE_TIME_PROBE, options as never),
    )
  ) {
    const rounded = differencePlainDateTimeWithRounding(
      one,
      two,
      one.calendarId,
      settings,
    );
    return temporalDurationFromInternal(
      rounded,
      isDateUnit(settings.largestUnit)
        ? "hour"
        : (settings.largestUnit as TimeUnit),
    );
  }

  return one.until(
    two,
    options as Temporal.DifferenceOptions<Temporal.DateTimeUnit>,
  );
}
