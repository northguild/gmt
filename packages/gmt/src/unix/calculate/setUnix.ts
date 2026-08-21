import { Temporal } from "@js-temporal/polyfill";
import { resolveOverflow } from "../../internal";
import type { Disambiguation, Offset, Overflow } from "../../types";
import { getSystemTimeZone } from "../../zoned/get";
import { isValidTimeZone } from "../../zoned/validate";

/**
 * Return a Unix epoch value with the given `fields` set on `value`, interpreted in `timeZone`.
 *
 * - Converts to ZonedDateTime, wraps `Temporal.ZonedDateTime.prototype.with()` (resolving every
 *   supplied field in a single atomic overflow pass), then converts back to epoch. This is the
 *   safe alternative to composing `addUnix()` calls field-by-field — see `setZoned`'s doc for
 *   why order-independent field resolution matters, and why `disambiguation`/`offset` require
 *   `.with()` rather than arithmetic.
 * - `fields` may set any of `year`, `month`, `monthCode`, `day`, `hour`, `minute`, `second`,
 *   `millisecond`, `microsecond`, `nanosecond`, `era`, and/or `eraYear`; omitted fields keep
 *   their current value. An empty object is a no-op.
 * - `overflow` ("constrain" (default) | "reject") controls out-of-range results, e.g. setting
 *   `month: 2` on a value whose `day` is 31: "constrain" clamps to Feb 29/28, "reject" throws
 *   (resulting in null).
 * - Returns null for invalid input.
 *
 * @param value Unix timestamp (number)
 * @param fields Partial<Temporal.ZonedDateTimeLike> object (excluding calendar/timeZone/offset) specifying fields to set
 * @param options optional: epochUnit ("seconds" | "milliseconds"), timeZone (IANA), overflow ("constrain" | "reject"), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "ignore")
 * @returns Unix epoch number with fields set, or null on invalid input
 *
 * @example setUnix(1710072000000, { hour: 9 }, { timeZone: "UTC" }) // 1710061200000 (2024-03-10T09:00:00Z)
 * @example setUnix(1706659200000, { year: 2025 }, { timeZone: "UTC" }) // 1738281600000 (2025-01-31T00:00:00Z)
 * @example setUnix(1706659200000, {}, { timeZone: "UTC" }) // 1706659200000 (empty fields object is a no-op)
 * @example setUnix(NaN, { hour: 9 }) // null
 */
export function setUnix(
  value: number,
  fields: Omit<Temporal.ZonedDateTimeLike, "calendar" | "timeZone" | "offset">,
  options?: {
    epochUnit?: "seconds" | "milliseconds";
    timeZone?: string;
    overflow?: Overflow;
    disambiguation?: Disambiguation;
    offset?: Offset;
  },
): number | null {
  const epochUnit = options?.epochUnit ?? "milliseconds";
  const timeZone = options?.timeZone ?? getSystemTimeZone();

  if (!timeZone || !isValidTimeZone(timeZone)) return null;
  if (!Number.isFinite(value) || !Number.isInteger(value)) return null;

  const overflow = resolveOverflow(options?.overflow);
  const disambiguation = options?.disambiguation ?? "compatible";
  // "ignore" (not Temporal's own "prefer" default) so `disambiguation` actually takes effect —
  // see C3 / docs/dst-disambiguation.md: with "prefer", the source's still-valid offset is kept
  // and disambiguation is silently never consulted.
  const offset = options?.offset ?? "ignore";

  try {
    const epochMs = epochUnit === "seconds" ? value * 1000 : value;
    const instant = Temporal.Instant.fromEpochMilliseconds(epochMs);
    const zoned = instant.toZonedDateTimeISO(timeZone);
    // Temporal.ZonedDateTime.prototype.with() throws on an empty fields object ("no supported
    // properties found") rather than treating it as a no-op, so short-circuit here.
    const result =
      Object.keys(fields).length === 0
        ? zoned
        : zoned.with(fields, { overflow, disambiguation, offset });

    return epochUnit === "seconds"
      ? Math.floor(result.epochMilliseconds / 1000)
      : result.epochMilliseconds;
  } catch {
    return null;
  }
}
