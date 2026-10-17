// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import type { Temporal } from "@js-temporal/polyfill";
import {
  DATE_TIME_FIELDS,
  frameInstant,
  frameZoned,
  normalizeZoneFrame,
  readSetFields,
  resolveOverflow,
  withZonedFields,
} from "../../internal";
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
 *   `millisecond`, `microsecond` and/or `nanosecond`; omitted fields keep their current value. An
 *   object with no field set, such as `{}` or `{ year: undefined }`, is a no-op.
 * - Values are not converted: `monthCode` must be a string and every other field an integer number.
 *   `null`, a numeric string, a boolean or a fraction returns null, where Temporal would convert or
 *   truncate it. A bigint, `NaN` or an infinity returns null too. A number too large for its
 *   field follows `overflow`. A month or day below 1, or a date outside Temporal's range, returns
 *   null.
 * - An own key that is not one of these fields, such as a misspelt `yaer`, returns null. So does an
 *   era, an `offset`, or a `calendar` or `timeZone` property, whether own, inherited or a getter. A
 *   field is read with a property get, as Temporal reads it, so an inherited or getter field is
 *   set.
 * - A Temporal date or time object returns null, as Temporal's `with` refuses one. One whose
 *   prototype has been replaced with `Object.prototype`, `null` or `Function.prototype` sets
 *   nothing instead.
 * - `value` is a safe integer or a digit string (`"1710072000000"`); anything else returns null.
 * - Returns null for invalid input.
 * - **Limit at an offset with seconds.** The instant is placed in the offset's whole-minute zone,
 *   moved by its seconds, and the moved instant must be inside Temporal's range. So within the
 *   offset's seconds (under a minute) of the last instant Temporal supports
 *   (`+275760-09-13T00:00:00Z`) for an offset east of UTC, or of the first
 *   (`-271821-04-20T00:00:00Z`) for one west, this returns `null`. An offset to the minute has no
 *   such limit.
 *
 * @param value Unix epoch: a safe integer, or a string of optionally negative ASCII digits
 * @param fields Partial<Temporal.ZonedDateTimeLike> object (excluding calendar/timeZone/offset) specifying fields to set
 * @param options optional: how `value` is read, and how an out-of-range field or a skipped or repeated wall-clock time is resolved
 * @returns Unix epoch number with fields set, or null on invalid input
 *
 * @example setUnix(1710072000000, { hour: 9 }, { timeZone: "UTC" }) // 1710061200000 (2024-03-10T09:00:00Z)
 * @example setUnix(1706659200000, { year: 2025 }, { timeZone: "UTC" }) // 1738281600000 (2025-01-31T00:00:00Z)
 * @example setUnix(1706659200000, {}, { timeZone: "UTC" }) // 1706659200000 (empty fields object is a no-op)
 * @example setUnix(1729992600000, { minute: 45 }, { timeZone: "Europe/London" }) // 1729993500000 (the second 01:30 keeps +00:00)
 * @example setUnix(1729992600000, { minute: 45 }, { timeZone: "Europe/London", offset: "ignore" }) // 1729989900000 (re-resolved: the earlier 01:45)
 * @example setUnix(1710072000000, { hour: "9" }, { timeZone: "UTC" }) // null (not converted)
 * @example setUnix(NaN, { hour: 9 }) // null
 */
export function setUnix(
  value: number | string,
  fields: Omit<
    Temporal.ZonedDateTimeLike,
    "calendar" | "timeZone" | "offset" | "era" | "eraYear"
  >,
  options?: {
    /**
     * The unit the epoch values are counted in: `"seconds"` or `"milliseconds"`, singular or
     * plural. Any other value returns `null`. The result is in the same unit.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
    /**
     * The time zone the fields are set in: an IANA name, a UTC offset (a time zone identifier such
     * as `+05:30`, `+0530` or `-08`, or a stored offset `±HH:MM[:SS]`, what `getTimeZoneOffset`
     * returns), or `"local"` for the system time zone. An unknown zone returns `null`.
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
    const frame = normalizeZoneFrame(options?.timeZone);

    if (frame === null || epochUnit === null) return null;

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
      const zoned = frameZoned(instant, frame);
      const set = readSetFields(fields, DATE_TIME_FIELDS);
      if (set === null) return null;
      // Only the values readSetFields checked reach Temporal, on both paths of withZonedFields. An
      // empty result sets nothing: a no-op here, where Temporal's with() would throw.
      const result =
        Object.keys(set).length === 0
          ? zoned
          : withZonedFields(zoned, set, {
              overflow,
              disambiguation,
              offset,
            });

      return toUnixEpoch(frameInstant(result, frame), epochUnit);
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
