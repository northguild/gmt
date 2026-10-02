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
import { optionOrDefault } from "../../internal/optionOrDefault";

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
 * - `value` is a safe integer or a digit string (`"1710072000000"`); anything else returns null.
 * - Returns null for invalid input.
 *
 * @param value Unix epoch: a safe integer, or a string of optionally negative ASCII digits
 * @param fields Partial<Temporal.ZonedDateTimeLike> object (excluding calendar/timeZone/offset) specifying fields to set
 * @param options optional: how `value` is read, and how an out-of-range field or a skipped or repeated wall-clock time is resolved
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
    /**
     * The unit the epoch values are counted in: `"seconds"` or `"milliseconds"`, singular or
     * plural. Any other value returns `null`. The result is in the same unit.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
    /**
     * The time zone the fields are set in: an IANA name, a UTC offset, or `"local"` for the system
     * time zone. An unknown zone returns `null`.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
    /**
     * How an out-of-range field is handled, such as `month: 2` on a value whose day is 31.
     * `"constrain"` clamps to the nearest valid value, and `"reject"` returns `null`.
     *
     * @defaultValue `"constrain"`, Temporal's default.
     */
    overflow?: Overflow;
    /**
     * How a wall-clock time that a zone transition skips or repeats is resolved, once `offset` does
     * not settle it. `"compatible"` takes the later time in a gap and the earlier of a repeat,
     * `"earlier"` and `"later"` take that side, and `"reject"` returns `null`.
     *
     * @defaultValue `"compatible"`, Temporal's default.
     */
    disambiguation?: Disambiguation;
    /**
     * How the source's UTC offset is weighed against the new wall-clock time, as in
     * `Temporal.ZonedDateTime.prototype.with`. `"prefer"` keeps it while it is still valid, so a
     * repeated hour stays on the same side of a fall-back, and `"use"` keeps it always. `"ignore"`
     * re-resolves the wall clock with `disambiguation`, and `"reject"` returns `null` when the
     * offset is no longer valid.
     *
     * @defaultValue `"prefer"`, Temporal's default.
     */
    offset?: Offset;
  },
): number | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }

    const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
    const timeZone = normalizeTimeZone(options?.timeZone);

    if (!timeZone || epochUnit === null) return null;

    const instant = unixEpochToInstant(value, epochUnit);
    if (instant === null) return null;

    const overflow = resolveOverflow(options?.overflow);
    const disambiguation = optionOrDefault(
      options?.disambiguation,
      "compatible",
    );
    // Temporal ZonedDateTime.prototype.with: GetTemporalOffsetOption(options, "prefer").
    const offset = optionOrDefault(options?.offset, "prefer");

    try {
      const zoned = instant.toZonedDateTimeISO(timeZone);
      // Temporal.ZonedDateTime.prototype.with() throws on an empty fields object ("no supported
      // properties found") rather than treating it as a no-op, so short-circuit here.
      const result =
        Object.keys(fields).length === 0
          ? zoned
          : withZonedFields(zoned, fields, {
              overflow,
              disambiguation,
              offset,
            });

      return toUnixEpoch(result, epochUnit);
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
