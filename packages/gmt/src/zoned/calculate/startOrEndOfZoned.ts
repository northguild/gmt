import {
  defaultFractionalDigits,
  zonedDateTimeFrom,
  zonedUnitEnd,
  zonedUnitStart,
} from "../../internal";
import { isValidDateTimeUnit } from "../../plain/validate";
import type { DateTimeUnit, FractionalDigit } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Internal shared implementation for `startOfZoned` / `endOfZoned`.
 *
 * - Snaps to the real local bucket from `internal/zonedBucket.ts` in `value`'s own zone: a
 *   start is never after `value`, an end never before it.
 * - `weekStartsOn` picks the week's first day; `fractionalSecondDigits` defaults to the unit's
 *   own precision (see `defaultFractionalDigits`).
 * - Callers accept `disambiguation`/`offset` for compatibility and never pass them here.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit DateTimeUnit to snap to
 * @param options optional: weekStartsOn, fractionalSecondDigits
 * @param isEnd false for start-of-unit, true for end-of-unit
 * @returns zoned ISO 8601 string, or "" on invalid input
 */
export function startOrEndOfZoned(
  value: string,
  unit: DateTimeUnit,
  options: {
    weekStartsOn?: "monday" | "sunday";
    fractionalSecondDigits?: FractionalDigit;
  },
  isEnd: boolean,
): string {
  if (!isValidZonedDateTime(value) || !isValidDateTimeUnit(unit)) return "";

  const weekStartDay = (options.weekStartsOn ?? "monday") === "monday" ? 1 : 7;
  const fractionalSecondDigits = defaultFractionalDigits(
    unit,
    options.fractionalSecondDigits,
  );

  try {
    const source = zonedDateTimeFrom(value);
    const boundary = isEnd
      ? zonedUnitEnd(source, unit, weekStartDay)
      : zonedUnitStart(source, unit, weekStartDay);

    return boundary ? boundary.toString({ fractionalSecondDigits }) : "";
  } catch {
    return "";
  }
}
