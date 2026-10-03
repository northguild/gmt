import type { RelativeUnit } from "../types";

/**
 * Resolve the `largestUnit` option of a `formatRelative*` function to one of the units the
 * function allows, in its singular form.
 *
 * - Temporal reads a unit option with GetTemporalUnitValuedOption, which takes a plural name as
 *   its singular, then checks it with ValidateTemporalUnitValue against the unit group of the
 *   type — date, time or datetime — and throws RangeError for a unit outside the group:
 *   `Temporal.PlainDate.prototype.until` rejects `"hour"`, `Temporal.PlainTime.prototype.until`
 *   rejects `"day"`. `allowed` is that group for the calling function.
 * - `undefined` is the omitted option (GetOption), so the caller picks the unit from the distance.
 * - Unit names are lower case, as in Temporal.
 * - The set of units is Temporal's. Rejecting a value that is not a string is GMT's own rule, and
 *   stricter than Temporal: GetOption converts any value with ToString, so Temporal accepts
 *   `["day"]` and an object whose `toString` returns `"day"` (test262
 *   `largestunit-wrong-type.js`). GMT takes string inputs, and its other unit readers
 *   (`roundDate`, `roundDateTime`, `roundUtc`, `roundZoned`, `startOfDate`, `durationAs`,
 *   `areDatesEqualBy`) reject a non-string the same way, so this one does not convert either.
 *
 * @param largestUnit the option as read from the caller's object, `undefined` when absent
 * @param allowed the singular units the calling function lists in its type
 * @returns the singular unit, or `undefined` when the option is absent; throws RangeError for any
 *   other value, for the caller's sentinel
 *
 * @example resolveRelativeUnit("hours", ["hour", "minute", "second"]) // "hour"
 * @example resolveRelativeUnit(undefined, ["hour", "minute", "second"]) // undefined
 * @example resolveRelativeUnit("day", ["hour", "minute", "second"]) // throws RangeError
 * @example resolveRelativeUnit(["hour"], ["hour", "minute", "second"]) // throws RangeError (GMT's rule; Temporal converts it to "hour")
 */
export function resolveRelativeUnit<Unit extends RelativeUnit>(
  largestUnit: unknown,
  allowed: readonly Unit[],
): Unit | undefined {
  if (largestUnit === undefined) {
    return undefined;
  }
  const unit =
    typeof largestUnit === "string"
      ? allowed.find(
          (name) => name === largestUnit || `${name}s` === largestUnit,
        )
      : undefined;
  if (unit === undefined) {
    throw new RangeError(`Invalid largestUnit: ${String(largestUnit)}`);
  }
  return unit;
}
