import type { Temporal } from "@js-temporal/polyfill";
import { resolveOverflow, withZonedFields } from "../../internal";
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  resolveUnixEpochUnit,
  toUnixEpoch,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import type { Disambiguation, Offset, Overflow } from "../../types";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

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
 * - `value` is a safe integer or a digit string (`"1710072000000"`); anything else returns null.
 * - An omitted `timeZone` is UTC; pass `"local"` for the system time zone.
 * - `offset` defaults to `"prefer"`, as `Temporal.ZonedDateTime.prototype.with`: the source's
 *   offset is kept while it is still valid for the new wall-clock time, so a repeated hour stays on
 *   the same side of a fall-back. Pass `offset: "ignore"` to re-resolve the wall clock with
 *   `disambiguation`.
 * - Returns null for invalid input.
 *
 * @param value Unix epoch: a safe integer, or a string of optionally negative ASCII digits
 * @param fields Partial<Temporal.ZonedDateTimeLike> object (excluding calendar/timeZone/offset) specifying fields to set
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"; an unknown zone returns null), overflow ("constrain" | "reject"), disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject", default "prefer")
 * @returns Unix epoch number with fields set, or null on invalid input
 *
 * @example setUnix(1710072000000, { hour: 9 }, { timeZone: "UTC" }) // 1710061200000 (2024-03-10T09:00:00Z)
 * @example setUnix(1706659200000, { year: 2025 }, { timeZone: "UTC" }) // 1738281600000 (2025-01-31T00:00:00Z)
 * @example setUnix(1706659200000, {}, { timeZone: "UTC" }) // 1706659200000 (empty fields object is a no-op)
 * @example setUnix(1730615400000, { minute: 45 }, { timeZone: "America/New_York" }) // 1730616300000 (the second 01:30 keeps -05:00)
 * @example setUnix(1730615400000, { minute: 45 }, { timeZone: "America/New_York", offset: "ignore" }) // 1730612700000 (re-resolved: the earlier 01:45)
 * @example setUnix(NaN, { hour: 9 }) // null
 */
export function setUnix(
  value: number | string,
  fields: Omit<Temporal.ZonedDateTimeLike, "calendar" | "timeZone" | "offset">,
  options?: {
    epochUnit?: UnixUnit;
    timeZone?: string;
    overflow?: Overflow;
    disambiguation?: Disambiguation;
    offset?: Offset;
  },
): number | null {
  if (!isOptionsArgument(options)) {
    return null;
  }

  const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
  const timeZone = normalizeTimeZone(options?.timeZone);

  if (!timeZone || epochUnit === null) return null;

  const instant = unixEpochToInstant(value, epochUnit);
  if (instant === null) return null;

  const overflow = resolveOverflow(options?.overflow);
  const disambiguation = options?.disambiguation ?? "compatible";
  // Temporal ZonedDateTime.prototype.with: GetTemporalOffsetOption(options, "prefer").
  const offset = options?.offset ?? "prefer";

  try {
    const zoned = instant.toZonedDateTimeISO(timeZone);
    // Temporal.ZonedDateTime.prototype.with() throws on an empty fields object ("no supported
    // properties found") rather than treating it as a no-op, so short-circuit here.
    const result =
      Object.keys(fields).length === 0
        ? zoned
        : withZonedFields(zoned, fields, { overflow, disambiguation, offset });

    return toUnixEpoch(result, epochUnit);
  } catch {
    return null;
  }
}
