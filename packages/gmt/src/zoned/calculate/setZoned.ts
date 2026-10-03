import { Temporal } from "@js-temporal/polyfill";
import {
  resolveOverflow,
  withZonedFields,
  zonedDateTimeFrom,
} from "../../internal";
import type { Disambiguation, Offset, Overflow } from "../../types";
import { isValidZonedDateTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";
import { optionOrDefault } from "../../internal/optionOrDefault";

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
 * - **Compatibility:** before 1.16.0 `offset` defaulted to `"ignore"`. Pass `{ offset: "ignore" }`
 *   to keep that resolution.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param fields Partial<Temporal.ZonedDateTimeLike> object (excluding calendar/timeZone/offset) specifying fields to set
 * @param options optional settings for resolving an out-of-range date and the new wall-clock time
 * @returns zoned ISO 8601 string with fields set, or "" on invalid input
 *
 * @example setZoned("2024-03-10T12:00:00-04:00[America/New_York]", { hour: 9 }) // "2024-03-10T09:00:00-04:00[America/New_York]"
 * @example setZoned("2024-01-31T12:00:00-05:00[America/New_York]", { month: 2 }) // "2024-02-29T12:00:00-05:00[America/New_York]" (constrain clamps to the last valid day)
 * @example setZoned("2024-01-31T12:00:00-05:00[America/New_York]", { month: 2 }, { overflow: "reject" }) // ""
 * @example setZoned("2024-03-10T12:00:00-04:00[America/New_York]", {}) // "2024-03-10T12:00:00-04:00[America/New_York]" (empty fields object is a no-op)
 * @example setZoned("2024-11-03T01:45:00-05:00[America/New_York]", { minute: 0 }, { disambiguation: "reject" }) // "2024-11-03T01:00:00-05:00[America/New_York]" (offset defaults to "prefer": the source's -05:00 is still valid, so it is kept and "reject" never fires)
 * @example setZoned("2024-11-03T01:45:00-05:00[America/New_York]", { minute: 0 }, { disambiguation: "reject", offset: "ignore" }) // "" (offset "ignore" re-resolves the repeated 01:00, and "reject" throws)
 * @example setZoned("invalid", { hour: 9 }) // ""
 */
export function setZoned(
  value: string,
  fields: Omit<Temporal.ZonedDateTimeLike, "calendar" | "timeZone" | "offset">,
  options?: {
    /**
     * What happens when the result names a day its month does not have, such as setting `month: 2`
     * on 31 January. `"constrain"` clamps to the last valid day; `"reject"` returns `""`.
     *
     * @defaultValue `"constrain"`, Temporal's default.
     */
    overflow?: Overflow;
    /**
     * How the new wall-clock time resolves when it falls in a DST gap or overlap and `offset` does
     * not settle it. In a fall-back overlap `"compatible"` and `"earlier"` take the earlier instant
     * and `"later"` the later one; in a spring-forward gap `"compatible"` and `"later"` move the
     * wall clock forward by the gap length and `"earlier"` back by it. `"reject"` returns `""` for
     * both.
     *
     * @defaultValue `"compatible"`, Temporal's default.
     */
    disambiguation?: Disambiguation;
    /**
     * How the source's UTC offset is treated at the new wall-clock time, as in Temporal's
     * `ZonedDateTime#with`. `"prefer"` keeps it while it is still valid there (a repeated fall-back
     * hour) and otherwise resolves through `disambiguation`; `"ignore"` always resolves through
     * `disambiguation`. `"use"` keeps the offset even when that moves the wall clock, and
     * `"reject"` returns `""` when the offset is not valid for the new wall time.
     *
     * @defaultValue `"prefer"`, Temporal's default.
     */
    offset?: Offset;
  },
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

    if (!isValidZonedDateTime(value)) return "";

    const overflow = resolveOverflow(options?.overflow);
    const disambiguation = optionOrDefault(
      options?.disambiguation,
      "compatible",
    );
    // Temporal ZonedDateTime#with's own default: keep the source offset while it is still valid.
    const offset = optionOrDefault(options?.offset, "prefer");

    try {
      const zoned = zonedDateTimeFrom(value);
      // Temporal.ZonedDateTime.prototype.with() throws on an empty fields object ("no supported
      // properties found") rather than treating it as a no-op, so short-circuit here.
      if (Object.keys(fields).length === 0) return zoned.toString();

      return withZonedFields(zoned, fields, {
        overflow,
        disambiguation,
        offset,
      }).toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
