// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import {
  defaultFractionalDigits,
  isObject,
  resolveDateTimeUnit,
} from "../../internal";
import {
  addDateTimeUnit,
  getStartOfDateTimeUnit,
  getStartOfNextDateTimeUnit,
} from "../../internal/dateTimeUnitHelpers";
import { getDaysIntoDateUnit } from "../../internal/dateUnitHelpers";
import { measureNearRangeEnd } from "../../internal/measureNearRangeEnd";
import { resolveManualRoundingOptions } from "../../internal/resolveManualRoundingOptions";
import type { DateTimeUnit } from "../../types";
import { isValidDateTime, isValidDateTimeUnit } from "../validate";

const MILLISECONDS_PER_DAY = 86_400_000;

/** Milliseconds (with sub-millisecond fraction) from midnight to `source`'s wall-clock time. */
function millisecondsIntoDay(source: Temporal.PlainDateTime): number {
  return (
    source.hour * 3_600_000 +
    source.minute * 60_000 +
    source.second * 1_000 +
    source.millisecond +
    source.microsecond / 1_000 +
    source.nanosecond / 1_000_000
  );
}

/** Temporal.PlainDateTime.round() in this polyfill supports day and time units. */
const TIME_UNITS: readonly string[] = [
  "day",
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
];

type RoundableTimeUnit = Temporal.SmallestUnit<
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "millisecond"
  | "microsecond"
  | "nanosecond"
>;

/** Round a day or time unit through Temporal.PlainDateTime.round(). Throws on invalid options. */
function roundTimeUnit(
  source: Temporal.PlainDateTime,
  smallestUnit: RoundableTimeUnit,
  roundingIncrement: number | undefined,
  roundingMode: Temporal.RoundingMode | undefined,
): string {
  const result = source.round({
    smallestUnit,
    roundingIncrement,
    roundingMode,
  });

  const fractionalDigits = defaultFractionalDigits(smallestUnit);

  return result.toString({ fractionalSecondDigits: fractionalDigits });
}

/** Rounds up at or past the half-way point. */
const upAtHalf = (_elapsedMs: number, fraction: () => number): boolean =>
  fraction() >= 0.5;

/** Rounds up only past the half-way point. */
const upPastHalf = (_elapsedMs: number, fraction: () => number): boolean =>
  fraction() > 0.5;

/**
 * Whether a date unit rounds up to the next start, per rounding mode.
 *
 * `fraction` is the position within the unit, computed lazily because only the half modes need it.
 */
const ROUNDS_UP_TO_NEXT_START: Readonly<
  Record<
    Temporal.RoundingMode,
    (elapsedMs: number, fraction: () => number) => boolean
  >
> = {
  ceil: (elapsedMs) => elapsedMs > 0,
  expand: (elapsedMs) => elapsedMs > 0,
  floor: () => false,
  trunc: () => false,
  halfExpand: upAtHalf,
  halfCeil: upAtHalf,
  halfTrunc: upPastHalf,
  halfFloor: upPastHalf,
  // Half-even breaks an exact tie towards the even multiple of the increment. The grid here is
  // anchored at the unit containing `source` — `startOfNext` counts the increment from that unit,
  // not from an absolute epoch — so the current start is multiple 0 and `startOfNext` is multiple
  // 1. The even multiple at a tie is therefore always the current start. Above and below the tie it
  // rounds to the nearer start, like every other half mode.
  halfEven: upPastHalf,
};

/** Manually round to a date unit (year, month, week). Throws when a needed start is out of range. */
function roundDateUnit(
  source: Temporal.PlainDateTime,
  smallestUnit: DateTimeUnit,
  increment: number,
  mode: Temporal.RoundingMode,
): string {
  // Measured towards the next start, never from the current one: the first representable
  // PlainDateTime is -271821-04-19T00:00:00.000000001, so the week, month and year holding it
  // began before the range, and only the next start exists. A PlainDateTime has no DST, so a day
  // is always 86,400,000 ms. Each start is built only when the mode needs it, and the unit's
  // length is measured on a value in the same place of its 400-year cycle when the next start lies
  // after the last representable value, where the current start may still be the answer.
  const elapsedMs =
    getDaysIntoDateUnit(source, smallestUnit) * MILLISECONDS_PER_DAY +
    millisecondsIntoDay(source);
  const startOfNextFrom = (
    from: Temporal.PlainDateTime,
  ): Temporal.PlainDateTime =>
    addDateTimeUnit(
      getStartOfNextDateTimeUnit(from, smallestUnit),
      smallestUnit,
      increment - 1,
    );
  const fraction = (): number =>
    elapsedMs /
    (elapsedMs +
      measureNearRangeEnd(source, (from) =>
        from.until(startOfNextFrom(from)).total("milliseconds"),
      ));

  // getStartOfDateTimeUnit throws (so the caller returns "") when the start lies outside the range.
  const rounded = ROUNDS_UP_TO_NEXT_START[mode](elapsedMs, fraction)
    ? startOfNextFrom(source)
    : getStartOfDateTimeUnit(source, smallestUnit);

  return rounded.toString();
}

/**
 * Round an ISO 8601 datetime string to the specified date-time unit.
 *
 * - Returns "" for invalid inputs.
 * - Accepts all date and time units: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Each unit is accepted in its singular or plural form ("day" or "days"), as Temporal's
 *   GetTemporalUnitValuedOption accepts both.
 * - Time units use Temporal.PlainDateTime.round() directly.
 * - Date units (year, month, week) use manual start-of-unit rounding. Weeks start on Monday.
 * - For date units the rounding grid is anchored at the unit containing `value`, so `"halfEven"`
 *   breaks an exact tie towards that unit's start (multiple 0, the even one). Time units round
 *   through Temporal, which anchors half-even on its own absolute grid.
 * - For date units the position within the unit is measured towards the next start, so a value in
 *   a unit that began before the first representable PlainDateTime
 *   (`-271821-04-19T00:00:00.000000001`) still rounds up to the next start. When it rounds down to
 *   that unrepresentable start, the result is "".
 * - In the last representable year (`+275760`) a value that rounds down to a date unit still
 *   returns that unit's start; only rounding up past `+275760-09-13T23:59:59.999999999` returns "".
 * - `roundingIncrement` and `roundingMode` are read as Temporal reads them for every unit: a
 *   non-integer increment is truncated (`1.5` rounds by 1), an increment below 1 or not finite
 *   returns "", and a `roundingMode` outside Temporal's nine returns "" (previously a date unit
 *   floored silently).
 * - Wraps all Temporal calls in try-catch; returns "" on any error.
 * - Output precision follows `smallestUnit`: no fractional seconds for "second" and coarser,
 *   3 digits for "millisecond", 6 for "microsecond" and 9 for "nanosecond", so the result never
 *   hides the precision the unit asked for.
 *
 * @param value ISO 8601 datetime string
 * @param options Rounding options: smallestUnit, optional roundingIncrement and roundingMode
 * @returns Rounded ISO 8601 datetime string, or "" on invalid input
 *
 * @example roundDateTime("2024-06-15T12:34:56", { smallestUnit: "year" }) // "2024-01-01T00:00:00"
 * @example roundDateTime("2024-06-15T12:34:56", { smallestUnit: "month" }) // "2024-06-01T00:00:00" (under half way: rounds down)
 * @example roundDateTime("2024-06-16T12:34:56", { smallestUnit: "month" }) // "2024-07-01T00:00:00" (past half way: rounds up)
 * @example roundDateTime("-271821-04-19T12:00:00", { smallestUnit: "month" }) // "-271821-05-01T00:00:00" (the month began before the range)
 * @example roundDateTime("+275760-06-15T00:00:00", { smallestUnit: "year", roundingMode: "floor" }) // "+275760-01-01T00:00:00" (the next year is past the range)
 * @example roundDateTime("2024-06-15T12:34:56", { smallestUnit: "day" }) // "2024-06-16T00:00:00"
 * @example roundDateTime("2024-06-15T12:34:56", { smallestUnit: "hour" }) // "2024-06-15T13:00:00"
 * @example roundDateTime("2024-06-15T12:34:56", { smallestUnit: "hours" }) // "2024-06-15T13:00:00" (plural unit name)
 * @example roundDateTime("2024-06-15T12:34:56.123456789", { smallestUnit: "millisecond" }) // "2024-06-15T12:34:56.123" (precision follows the unit)
 * @example roundDateTime("2024-05-15T12:00:00", { smallestUnit: "month", roundingMode: "bogus" as never }) // ""
 * @example roundDateTime("invalid", { smallestUnit: "year" }) // ""
 */
export function roundDateTime(
  value: string,
  options: {
    smallestUnit: Temporal.SmallestUnit<DateTimeUnit>;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
  },
): string {
  if (!isObject(options)) return "";

  const { roundingIncrement, roundingMode } = options;
  const smallestUnit: unknown =
    typeof options.smallestUnit === "string"
      ? resolveDateTimeUnit(options.smallestUnit)
      : options.smallestUnit;

  if (!isValidDateTime(value) || !isValidDateTimeUnit(smallestUnit)) return "";

  try {
    const source = Temporal.PlainDateTime.from(value);

    if (TIME_UNITS.includes(smallestUnit)) {
      return roundTimeUnit(
        source,
        smallestUnit as RoundableTimeUnit,
        roundingIncrement,
        roundingMode,
      );
    }

    // Manual rounding for date units (year, month, week)
    const resolved = resolveManualRoundingOptions(
      roundingIncrement,
      roundingMode,
    );
    if (resolved === null) return "";

    return roundDateUnit(
      source,
      smallestUnit,
      resolved.increment,
      resolved.mode,
    );
  } catch {
    return "";
  }
}
