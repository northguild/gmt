import type { DateTimeDurationUnit } from "../types";
import { isObject } from "./isObject";
import { isValidAmount } from "./isValidAmount";

/**
 * The ten fields TC39 Temporal reads from a duration-like object, in the order it reads them:
 * ToTemporalPartialDurationRecord (7.5.18) gets them in alphabetical order.
 */
const DURATION_UNIT_NAMES = [
  "days",
  "hours",
  "microseconds",
  "milliseconds",
  "minutes",
  "months",
  "nanoseconds",
  "seconds",
  "weeks",
  "years",
] as const satisfies readonly DateTimeDurationUnit[];

/**
 * Read a `units` argument, such as `{ minutes: 15 }`, the way Temporal reads a duration-like
 * object, and return the amounts as a fresh plain object that holds only the caller's units.
 *
 * The check and the read are one pass, so nothing reaches Temporal that was not checked:
 *
 * - `units` must be an Object (`isObject`), a function included.
 * - An own enumerable string key that `isAllowed` refuses returns `null`, whatever its value.
 *   This is the guard against a misspelt key, which Temporal on its own ignores. A symbol key and
 *   a non-enumerable key that is no unit name are not entries and are ignored.
 * - Each of the ten unit names is read once with an ordinary property get, in the order Temporal's
 *   ToTemporalPartialDurationRecord reads them, so an inherited or non-enumerable unit applies.
 *   `undefined` means the unit is absent. Any other value must be a finite number; nothing is
 *   converted to one.
 * - A unit `isAllowed` refuses returns `null` when its amount is not zero. Zero is no amount:
 *   Temporal too tells a calendar duration from an exact one by its nonzero fields.
 * - No allowed unit present returns `null`.
 *
 * Whole numbers, one sign and the range are left to Temporal, which throws for each. A getter
 * that throws is not caught here; the calling function's own catch returns its sentinel.
 *
 * @param units the caller's `units` argument
 * @param isAllowed type guard for the units the calling function takes
 * @returns a new plain object of the allowed units that were present, or null on invalid input
 *
 * @example readDurationUnits({ minutes: 15 }, isValidTimeDurationUnit) // { minutes: 15 }
 * @example readDurationUnits({ minutes: 15, hours: undefined }, isValidTimeDurationUnit) // { minutes: 15 }
 * @example readDurationUnits({ minutes: 15, hour: 1 }, isValidTimeDurationUnit) // null (unknown key)
 * @example readDurationUnits(Object.create({ minutes: "15" }), isValidTimeDurationUnit) // null (not a number)
 * @example readDurationUnits(Object.create({ days: 1 }), isValidTimeDurationUnit) // null (a unit outside the set)
 * @example readDurationUnits({}, isValidTimeDurationUnit) // null
 */
export function readDurationUnits<Unit extends DateTimeDurationUnit>(
  units: unknown,
  isAllowed: (unit: string) => unit is Unit,
): Partial<Record<Unit, number>> | null {
  if (!isObject(units)) {
    return null;
  }

  if (!Object.keys(units).every((key) => isAllowed(key))) {
    return null;
  }

  const record = units as Record<string, unknown>;
  const read: Partial<Record<Unit, number>> = {};
  let present = false;

  for (const name of DURATION_UNIT_NAMES) {
    const amount = record[name];

    if (amount === undefined) {
      continue;
    }

    if (!isValidAmount(amount as number)) {
      return null;
    }

    if (isAllowed(name)) {
      read[name] = amount as number;
      present = true;
    } else if (amount !== 0) {
      return null;
    }
  }

  return present ? read : null;
}
