import { Temporal } from "@js-temporal/polyfill";
import { resolveOverflow } from "../../internal";
import type { Disambiguation, Offset, Overflow } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return a zoned ISO 8601 datetime string with the given `fields` set on `value`.
 *
 * - Wraps `Temporal.ZonedDateTime.prototype.with()`, which resolves every supplied field in a
 *   single atomic overflow pass. This is the safe alternative to composing `addZoned()` calls
 *   field-by-field, and it is the only construction path that can reproduce
 *   `startOfZoned`'s disambiguation-plus-offset handling — `addZoned()` has no `offset` control
 *   equivalent to `.with()`'s, because Temporal's `ZonedDateTime.prototype.add()` doesn't accept
 *   `disambiguation`/`offset` at all.
 * - `fields` may set any of `year`, `month`, `monthCode`, `day`, `hour`, `minute`, `second`,
 *   `millisecond`, `microsecond`, `nanosecond`, `era`, and/or `eraYear`; omitted fields keep
 *   their current value. An empty object is a no-op. `calendar`, `timeZone`, and `offset` are
 *   deliberately excluded from `fields` — this function only sets date/time components, never
 *   the zone or calendar identity, and `offset` is controlled separately via `options.offset`.
 * - `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. setting
 *   `month: 2` on a value whose `day` is 31: "constrain" clamps to Feb 29/28, "reject" throws
 *   (resulting in "").
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param fields Partial<Temporal.ZonedDateTimeLike> object (excluding calendar/timeZone/offset) specifying fields to set
 * @param options optional: overflow ("constrain" | "reject"), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore")
 * @returns zoned ISO 8601 string with fields set, or "" on invalid input
 *
 * @example setZoned("2024-03-10T12:00:00-04:00[America/New_York]", { hour: 9 }) // "2024-03-10T09:00:00-04:00[America/New_York]"
 * @example setZoned("2024-01-31T12:00:00-05:00[America/New_York]", { month: 2 }) // "2024-02-29T12:00:00-05:00[America/New_York]" (constrain clamps to the last valid day)
 * @example setZoned("2024-01-31T12:00:00-05:00[America/New_York]", { month: 2 }, { overflow: "reject" }) // ""
 * @example setZoned("2024-03-10T12:00:00-04:00[America/New_York]", {}) // "2024-03-10T12:00:00-04:00[America/New_York]" (empty fields object is a no-op)
 * @example setZoned("2024-11-03T01:45:00-05:00[America/New_York]", { minute: 0 }, { disambiguation: "reject" }) // "" (offset defaults to "ignore", so disambiguation actually fires and "reject" throws on this fall-back overlap)
 * @example setZoned("2024-11-03T01:45:00-05:00[America/New_York]", { minute: 0 }, { disambiguation: "reject", offset: "prefer" }) // "2024-11-03T01:00:00-05:00[America/New_York]" (offset:"prefer" makes disambiguation inert here — the source's -05:00 offset is still valid, so it's kept and "reject" never fires)
 * @example setZoned("invalid", { hour: 9 }) // ""
 */
export function setZoned(
  value: string,
  fields: Omit<Temporal.ZonedDateTimeLike, "calendar" | "timeZone" | "offset">,
  options?: {
    overflow?: Overflow;
    disambiguation?: Disambiguation;
    offset?: Offset;
  },
): string {
  if (!isValidZonedDateTime(value)) return "";

  const overflow = resolveOverflow(options?.overflow);
  const disambiguation = options?.disambiguation ?? "compatible";
  // "ignore" (not Temporal's own "prefer" default) so `disambiguation` actually takes effect —
  // see C3 / docs/dst-disambiguation.md: with "prefer", the source's still-valid offset is kept
  // and disambiguation is silently never consulted.
  const offset = options?.offset ?? "ignore";

  try {
    const zoned = Temporal.ZonedDateTime.from(value);
    // Temporal.ZonedDateTime.prototype.with() throws on an empty fields object ("no supported
    // properties found") rather than treating it as a no-op, so short-circuit here.
    if (Object.keys(fields).length === 0) return zoned.toString();

    return zoned.with(fields, { overflow, disambiguation, offset }).toString();
  } catch {
    return "";
  }
}
