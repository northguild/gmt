import { Temporal } from "../temporal";
import type { DurationRelativeTo } from "../../types";
import { isCalendarArithmeticCompatNeeded } from "../temporalCompat";
import { utcEpochNanoseconds } from "../zonedWallClock";
import {
  NANOSECONDS_PER_DAY,
  PLAIN_DATE_PROBE,
  bigintSign,
  calendarDateUntil,
  compareAtLimit,
  dateDurationDays,
  defaultLargestUnit,
  isCalendarUnit,
  largerUnit,
  plainContext,
  roundAtLimit,
  roundRelativeDuration,
  roundWithPlainRelativeTo,
  roundingSettings,
  timeZoneAnnotation,
  toInternalDuration,
  totalAtLimit,
  totalWithPlainRelativeTo,
} from "./operations";
import type {
  DateUnit,
  DurationRoundOptions,
  InternalDuration,
  RoundingSettings,
  Unit,
} from "./operations";

/*
 * ---------------------------------------------------------------------------------------------
 * Defect 3 — non-ISO calendar arithmetic (CORE-6 D1–D7)
 * ---------------------------------------------------------------------------------------------
 * 3. **Non-ISO calendar arithmetic** (CORE-6 D1–D7, see `../temporalCompat/README.md`). The
 *    polyfill's calendar `until` is wrong at month ends (D6), throws for Hebrew leap-month spans
 *    (D7) and near the range limits (D1), and reads buddhist, Hebrew <= 0 and Indian < 1 dates
 *    wrongly (D2–D5). A wrong difference is returned, not thrown, so no polyfill-first check can
 *    catch it.
 *    - Trigger: `isCalendarArithmeticCompatNeeded(calendar)` — one of that calendar's capability
 *      probes fails. `iso8601` never triggers it. The operation then takes the spec path in `./operations.ts`
 *      directly, and its two calendar seams (`calendarDateAdd`, `calendarDateUntil`) call the
 *      compat layer's entry points.
 *    - Retired by: the removal triggers in `../temporalCompat/README.md`; once every probe passes
 *      the trigger is false and the polyfill answers again.
 *    - Removal: delete this file and its calls in `../zonedWallClockDifference.ts` (the
 *      `isCalendarArithmeticCompatNeeded` term in `untilTakesSpecPath`, the `calendarTotalBySpec` and
 *      `calendarRoundBySpec` operands in `durationTotal` and `durationRound`, the
 *      `calendarCompareBySpec` statement and its `if` in `durationCompare`, and the
 *      `plainDateUntilWithRounding` re-export), and the `isCalendarArithmeticCompatNeeded` branch in `../plainDateUntil.ts`. The
 *      seams `calendarDateAdd` and `calendarDateUntil` in `./operations.ts` may keep calling the compat
 *      entry points, which are then the polyfill's calls. See `../temporalCompat/README.md` § Removal
 *      steps 6 for the order. The last of defects 3–5 to go also deletes `untilTakesSpecPath`, the
 *      `// defects 3–5` block in `zonedUntil` that calls `untilAtLimit`, and the `bySpec` blocks in
 *      `durationTotal` and `durationRound`. Then drop the imports and locals tsc reports unused, and
 *      the `./operations.ts` exports fallow reports unused.
 * ---------------------------------------------------------------------------------------------
 */

/**
 * `PlainDate#until(other, options)` with rounding options for two dates in one calendar, as TC39
 * `DifferenceTemporalPlainDate` computes it: `CalendarDateUntil` through the Temporal compat layer,
 * then — unless the granularity is one day — `RoundRelativeDuration` in a plain context.
 *
 * @param one the start, in the calendar to measure in
 * @param two the end, in the same calendar
 * @param options Temporal `largestUnit` / `smallestUnit` / `roundingIncrement` / `roundingMode`
 * @returns the rounded date duration; throws where TC39 Temporal throws
 */
export function plainDateUntilWithRounding(
  one: Temporal.PlainDate,
  two: Temporal.PlainDate,
  options: Temporal.DifferenceOptions<Temporal.DateUnit>,
): Temporal.Duration {
  // Validates the options exactly as PlainDate#until does, far from any limit.
  PLAIN_DATE_PROBE.until(PLAIN_DATE_PROBE, options);
  const settings = roundingSettings(
    options.largestUnit,
    options.smallestUnit ?? "day",
    (smallestUnit) => largerUnit("day", smallestUnit),
    options.roundingIncrement,
    options.roundingMode ?? "trunc",
  ) as RoundingSettings;
  if (Temporal.PlainDate.compare(one, two) === 0) {
    return new Temporal.Duration();
  }

  const calendar = one.calendarId;
  const start = one.withCalendar("iso8601").toPlainDateTime();
  const end = two.withCalendar("iso8601").toPlainDateTime();
  let duration: InternalDuration = {
    date: calendarDateUntil(
      calendar,
      start.toPlainDate(),
      end.toPlainDate(),
      settings.largestUnit as DateUnit,
    ),
    time: 0n,
  };
  if (settings.smallestUnit !== "day" || settings.increment !== 1) {
    duration = roundRelativeDuration(
      duration,
      utcEpochNanoseconds(start),
      utcEpochNanoseconds(end),
      plainContext(calendar, start),
      settings,
    );
  }

  const { years, months, weeks, days } = duration.date;
  return new Temporal.Duration(years, months, weeks, days);
}

/**
 * The plain `relativeTo` Temporal would resolve (TC39 `ToRelativeTemporalObject` keeps only the
 * date) when its calendar needs the Temporal compat layer in this runtime, or null. A string with
 * no calendar annotation is ISO, so it is never parsed here.
 */
function plainRelativeToNeedingCompat(
  relativeTo: DurationRelativeTo | undefined,
): Temporal.PlainDate | null {
  let plain: Temporal.PlainDate;
  try {
    if (relativeTo instanceof Temporal.PlainDateTime) {
      plain = relativeTo.toPlainDate();
    } else if (
      typeof relativeTo === "string" &&
      relativeTo.includes("u-ca=") &&
      !timeZoneAnnotation.test(relativeTo)
    ) {
      plain = Temporal.PlainDate.from(relativeTo);
    } else {
      return null;
    }
  } catch {
    return null;
  }
  return isCalendarArithmeticCompatNeeded(plain.calendarId) ? plain : null;
}

/** `Temporal.Duration.compare` with a plain `relativeTo`, when either operand has calendar units. */
function compareWithPlainRelativeTo(
  one: Temporal.Duration,
  two: Temporal.Duration,
  plain: Temporal.PlainDate,
): number | null {
  if (
    !isCalendarUnit(defaultLargestUnit(one)) &&
    !isCalendarUnit(defaultLargestUnit(two))
  ) {
    return null;
  }
  const first = toInternalDuration(one);
  const second = toInternalDuration(two);
  const time1 =
    first.time +
    BigInt(dateDurationDays(first.date, plain)) * NANOSECONDS_PER_DAY;
  const time2 =
    second.time +
    BigInt(dateDurationDays(second.date, plain)) * NANOSECONDS_PER_DAY;
  return bigintSign(time1 - time2);
}

/** Defect 3: `Duration#total` by the spec when the `relativeTo` calendar needs the compat layer. */
export function calendarTotalBySpec(
  duration: Temporal.Duration,
  unitOption: string,
  unit: Unit,
  relativeTo: DurationRelativeTo | undefined,
  zoned: Temporal.ZonedDateTime | null,
): number | null {
  if (zoned !== null) {
    return isCalendarArithmeticCompatNeeded(zoned.calendarId)
      ? totalAtLimit(duration, zoned, unitOption, unit)
      : null;
  }
  const plain = plainRelativeToNeedingCompat(relativeTo);
  return plain === null
    ? null
    : totalWithPlainRelativeTo(duration, plain, unitOption, unit);
}

/** Defect 3: `Duration#round` by the spec when the `relativeTo` calendar needs the compat layer. */
export function calendarRoundBySpec(
  duration: Temporal.Duration,
  roundTo: DurationRoundOptions,
  settings: RoundingSettings,
  zoned: Temporal.ZonedDateTime | null,
): Temporal.Duration | null {
  if (zoned !== null) {
    return isCalendarArithmeticCompatNeeded(zoned.calendarId)
      ? roundAtLimit(duration, zoned, roundTo, settings)
      : null;
  }
  const plain = plainRelativeToNeedingCompat(roundTo.relativeTo);
  return plain === null
    ? null
    : roundWithPlainRelativeTo(duration, plain, roundTo, settings);
}

/** Defect 3: `Duration.compare` by the spec when the `relativeTo` calendar needs the compat layer. */
export function calendarCompareBySpec(
  one: Temporal.Duration | string,
  two: Temporal.Duration | string,
  relativeTo: DurationRelativeTo | undefined,
  zoned: Temporal.ZonedDateTime | null,
): number | null {
  if (zoned !== null) {
    return isCalendarArithmeticCompatNeeded(zoned.calendarId)
      ? compareAtLimit(
          Temporal.Duration.from(one),
          Temporal.Duration.from(two),
          zoned,
        )
      : null;
  }
  const plain = plainRelativeToNeedingCompat(relativeTo);
  return plain === null
    ? null
    : compareWithPlainRelativeTo(
        Temporal.Duration.from(one),
        Temporal.Duration.from(two),
        plain,
      );
}
