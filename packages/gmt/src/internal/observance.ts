import type { ObservanceShift } from "../types";
import {
  nextBusinessEpochDay,
  type ResolvedBusinessCalendar,
} from "./businessCalendar";
import {
  ISO_WEEKDAYS,
  MAX_EPOCH_DAY,
  MIN_EPOCH_DAY,
  isoWeekdayOf,
} from "./epochDay";
import { isObject } from "./isObject";
import { isValidDayOfWeek } from "./isValidDayOfWeek";

/** Resolved policy: index 1..7 holds the shift for that weekday, or undefined. */
export type ResolvedObservancePolicy = readonly (ObservanceShift | undefined)[];

/** The `next` or `previous` key of a one-key shift object, or `null` for any other shape. */
function shiftDirection(value: unknown): "next" | "previous" | null {
  const keys =
    isObject(value) && !Array.isArray(value) ? Object.keys(value) : [];

  return keys.length === 1 && (keys[0] === "next" || keys[0] === "previous")
    ? keys[0]
    : null;
}

/** One shift, or `null` when it is not `"nextWorkingDay"`, `{ next: d }` or `{ previous: d }` with `d` another weekday. */
function parseShift(value: unknown, weekday: number): ObservanceShift | null {
  if (value === "nextWorkingDay") {
    return value;
  }

  const direction = shiftDirection(value);
  const target =
    direction === null ? null : (value as Record<string, unknown>)[direction];

  // A target equal to the holiday's own weekday would be a week's move: treated as a mistake.
  if (
    typeof target !== "number" ||
    !isValidDayOfWeek(target) ||
    target === weekday
  ) {
    return null;
  }

  return { [direction as "next"]: target } as ObservanceShift;
}

/**
 * Reduce a caller-supplied `ObservancePolicy` to a weekday-indexed table, or `null` when it is
 * not one: keys must be `"1"`..`"7"` and each value a valid shift.
 */
export function parseObservancePolicy(
  policy: unknown,
): ResolvedObservancePolicy | null {
  if (!isObject(policy) || Array.isArray(policy)) {
    return null;
  }

  const resolved: (ObservanceShift | undefined)[] = Array.from(
    { length: ISO_WEEKDAYS + 1 },
    () => undefined,
  );

  for (const key of Object.keys(policy)) {
    const weekday = Number(key);

    if (!isValidDayOfWeek(weekday) || String(weekday) !== key) {
      return null;
    }

    const shift = parseShift((policy as Record<string, unknown>)[key], weekday);

    if (shift === null) {
      return null;
    }

    resolved[weekday] = shift;
  }

  return resolved;
}

/** True when some weekday shifts to `"nextWorkingDay"`, which cannot be answered without a calendar. */
export function policyNeedsCalendar(policy: ResolvedObservancePolicy): boolean {
  return policy.includes("nextWorkingDay");
}

/**
 * Observed epoch day, the same day when no shift applies, or `null` (out of range, no calendar,
 * walk failed). `{ next: d }` moves 1..6 days later, `{ previous: d }` 1..6 days earlier. Throws
 * a `RangeError` when a `nextWorkingDay` walk passes Temporal's range.
 */
export function observedEpochDay(
  day: number,
  policy: ResolvedObservancePolicy,
  calendar: ResolvedBusinessCalendar | null,
): number | null {
  const shift = policy[isoWeekdayOf(day)];
  let result: number | null = day;

  if (shift === "nextWorkingDay") {
    result = calendar === null ? null : nextBusinessEpochDay(day, calendar);
  } else if (shift !== undefined) {
    const weekday = isoWeekdayOf(day);

    result =
      "next" in shift
        ? day + (((shift.next - weekday + 6) % ISO_WEEKDAYS) + 1)
        : day - (((weekday - shift.previous + 6) % ISO_WEEKDAYS) + 1);
  }

  return result === null || result < MIN_EPOCH_DAY || result > MAX_EPOCH_DAY
    ? null
    : result;
}
