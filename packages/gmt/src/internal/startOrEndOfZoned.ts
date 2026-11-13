import type { Temporal } from "./temporal";
import { defaultFractionalDigits } from "./defaultFractionalDigits";
import { zonedDateTimeOf } from "./zonedWallClock";
import { zonedUnitEnd, zonedUnitStart } from "./zonedBucket";
import { resolveDateTimeUnit } from "./resolveDateTimeUnit";
import { resolveWeekStartsOn } from "./resolveWeekStartsOn";
import { isDateTimeUnitName } from "./unitNames";
import type { DateTimeUnit, FractionalDigit } from "../types";
import { optionOrDefault } from "./optionOrDefault";

/**
 * Internal shared implementation for `startOfZoned` / `endOfZoned`.
 *
 * - Snaps to the real local bucket from `internal/zonedBucket.ts` in `value`'s own zone: a
 *   start is never after `value`, an end never before it.
 * - `weekStartsOn` picks the week's first day. An end is written at nanosecond precision by
 *   default (next start − 1 ns); a start's `fractionalSecondDigits` defaults to the unit's own
 *   precision (see `defaultFractionalDigits`).
 * - `unit` may be singular or plural; an invalid `weekStartsOn` returns "".
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit DateTimeUnit to snap to, singular or plural
 * @param options optional: weekStartsOn, fractionalSecondDigits
 * @param isEnd false for start-of-unit, true for end-of-unit
 * @returns zoned ISO 8601 string, or "" on invalid input
 */
export function startOrEndOfZoned(
  value: string,
  unit: Temporal.SmallestUnit<DateTimeUnit>,
  options: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
  },
  isEnd: boolean,
): string {
  const resolvedUnit = resolveDateTimeUnit(unit);
  const weekStartsOn = resolveWeekStartsOn(options.weekStartsOn);

  const source = zonedDateTimeOf(value);
  if (
    source === null ||
    !isDateTimeUnitName(resolvedUnit) ||
    weekStartsOn === null
  )
    return "";

  const weekStartDay = weekStartsOn === "monday" ? 1 : 7;
  // An end is next start − 1 ns, so it defaults to nanosecond precision: fewer digits would
  // print an earlier instant than the end (Calendar & zone semantics §3).
  const fractionalSecondDigits = isEnd
    ? optionOrDefault(options.fractionalSecondDigits, 9)
    : defaultFractionalDigits(resolvedUnit, options.fractionalSecondDigits);

  try {
    const boundary = isEnd
      ? zonedUnitEnd(source, resolvedUnit, weekStartDay)
      : zonedUnitStart(source, resolvedUnit, weekStartDay);

    return boundary ? boundary.toString({ fractionalSecondDigits }) : "";
  } catch {
    return "";
  }
}
