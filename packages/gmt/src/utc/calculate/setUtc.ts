import { Temporal } from "@js-temporal/polyfill";
import { resolveOverflow } from "../../internal";
import type { Disambiguation, Offset, Overflow } from "../../types";
import { isValidUtc } from "../validate/isValidUtc";

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
 * - `disambiguation` and `offset` are accepted for API consistency with `setZoned`/`setUnix`,
 *   but are **permanently inert** here: "UTC" has no DST transitions, so there is never an
 *   ambiguous local time or a stale offset for either option to act on (same precedent as
 *   `startOfUtc`/`endOfUtc`, Story C1/C2). Do not "fix" this by removing them.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g. "2024-03-10T12:00:00Z")
 * @param fields Partial<Temporal.ZonedDateTimeLike> object (excluding calendar/timeZone/offset) specifying fields to set
 * @param options optional: overflow ("constrain" | "reject"), disambiguation (accepted but inert, see above), offset (accepted but inert, see above)
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
    disambiguation?: Disambiguation;
    offset?: Offset;
  },
): string {
  if (!isValidUtc(value)) return "";

  const overflow = resolveOverflow(options?.overflow);
  const disambiguation = options?.disambiguation ?? "compatible";
  const offset = options?.offset ?? "ignore";

  try {
    const instant = Temporal.Instant.from(value);
    const zoned = instant.toZonedDateTimeISO("UTC");
    // Temporal.ZonedDateTime.prototype.with() throws on an empty fields object ("no supported
    // properties found") rather than treating it as a no-op, so short-circuit here.
    const result =
      Object.keys(fields).length === 0
        ? zoned
        : zoned.with(fields, { overflow, disambiguation, offset });
    return result.toInstant().toString();
  } catch {
    return "";
  }
}
