import { Temporal } from "@js-temporal/polyfill";
import { resolveOverflow } from "../../internal";
import type { Overflow } from "../../types";
import { isValidUtc } from "../validate/isValidUtc";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return a UTC Instant string with the given `fields` set on `value`.
 *
 * - Converts to ZonedDateTime (fixed timeZone "UTC"), wraps
 *   `Temporal.ZonedDateTime.prototype.with()` (resolving every supplied field in a single atomic
 *   overflow pass), then converts back to an Instant. This is the safe alternative to composing
 *   `addUtc()` calls field-by-field — see `setDate`'s doc for why order-independent field
 *   resolution matters.
 * - `fields` may set any of `year`, `month`, `monthCode`, `day`, `hour`, `minute`, `second`,
 *   `millisecond`, `microsecond`, `nanosecond`, `era`, and/or `eraYear`; omitted fields keep
 *   their current value. An empty object is a no-op.
 * - `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. setting
 *   `month: 2` on a value whose `day` is 31: "constrain" clamps to Feb 29/28, "reject" throws
 *   (resulting in "").
 * - There are no `disambiguation` or `offset` options (removed in 1.16.0): a UTC instant's wall
 *   clock is never ambiguous and its offset is always +00:00, so neither had anything to act on.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g. "2024-03-10T12:00:00Z")
 * @param fields Partial<Temporal.ZonedDateTimeLike> object (excluding calendar/timeZone/offset) specifying fields to set
 * @param options optional: overflow ("constrain" | "reject")
 * @returns UTC Instant string with fields set, or "" on invalid input
 *
 * @example setUtc("2024-03-10T12:00:00Z", { hour: 9 }) // "2024-03-10T09:00:00Z"
 * @example setUtc("2024-01-31T12:00:00Z", { month: 2 }) // "2024-02-29T12:00:00Z" (constrain clamps to the last valid day)
 * @example setUtc("2024-01-31T12:00:00Z", { month: 2 }, { overflow: "reject" }) // ""
 * @example setUtc("2024-03-10T12:00:00Z", {}) // "2024-03-10T12:00:00Z" (empty fields object is a no-op)
 * @example setUtc("invalid", { hour: 9 }) // ""
 */
export function setUtc(
  value: string,
  fields: Omit<Temporal.ZonedDateTimeLike, "calendar" | "timeZone" | "offset">,
  options?: {
    overflow?: Overflow;
  },
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

    if (!isValidUtc(value)) return "";

    const overflow = resolveOverflow(options?.overflow);

    try {
      const instant = Temporal.Instant.from(value);
      const zoned = instant.toZonedDateTimeISO("UTC");
      // Temporal.ZonedDateTime.prototype.with() throws on an empty fields object ("no supported
      // properties found") rather than treating it as a no-op, so short-circuit here.
      const result =
        Object.keys(fields).length === 0
          ? zoned
          : zoned.with(fields, { overflow });
      return result.toInstant().toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
