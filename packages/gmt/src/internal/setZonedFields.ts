import type { Temporal } from "./temporal";
import type { Disambiguation, Offset, Overflow } from "../types";
import { DATE_TIME_FIELDS, readSetFields } from "./readSetFields";
import { withZonedFields } from "./zonedWallClockOperations";

/**
 * The `setZoned` core: a `ZonedDateTime` with the checked `fields` set, correct at the range
 * limits on both paths.
 *
 * An empty set changes nothing, where Temporal's `with()` would throw. May throw where Temporal
 * does; each caller maps that to its sentinel.
 *
 * @param zoned the value to change
 * @param fields the caller's `fields` argument
 * @param options the resolved `overflow`, `disambiguation` and `offset`
 * @returns the changed value, or `null` when `fields` is invalid
 *
 * @example setZonedFields(zoned, { hour: 9 }, { overflow: "constrain", disambiguation: "compatible", offset: "prefer" })?.toString()
 */
export function setZonedFields(
  zoned: Temporal.ZonedDateTime,
  fields: unknown,
  options: {
    overflow: Overflow;
    disambiguation: Disambiguation;
    offset: Offset;
  },
): Temporal.ZonedDateTime | null {
  const set = readSetFields(fields, DATE_TIME_FIELDS);
  if (set === null) return null;
  if (Object.keys(set).length === 0) return zoned;
  return withZonedFields(zoned, set, options);
}
