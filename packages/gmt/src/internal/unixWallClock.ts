import type { Temporal } from "./temporal";
import { isoYearString } from "./isoYearString";
import { resolveDateTimeUnit } from "./resolveDateTimeUnit";
import { resolveWeekStartsOn } from "./resolveWeekStartsOn";
import { weekNumberOf } from "./weekNumber";
import { resolveUnixEpochUnit, unixEpochToInstant } from "./unixEpochValue";
import { frameWallClock, normalizeZoneFrame } from "./zoneFrame";

/**
 * Read a Unix epoch argument on the local wall clock of the shared `unix/` options, or null when
 * anything is invalid. For the `parse*FromUnix` accessors, which only read fields.
 *
 * - `value` follows the one epoch grammar (`parseUnixEpochValue`).
 * - `epochUnit` accepts singular or plural names and defaults to `"milliseconds"`.
 * - `timeZone` defaults to `"UTC"`; `"local"` is the system zone; a time zone identifier or a
 *   stored UTC offset (`±HH:MM[:SS]`) is read as written; anything else is invalid (see
 *   `normalizeZoneFrame`).
 *
 * @param value Unix epoch number or digit string
 * @param options optional `{ epochUnit, timeZone }`
 * @returns the local wall clock, or null
 *
 * @example unixWallClock(0)?.toString() // "1970-01-01T00:00:00"
 * @example unixWallClock("86400", { epochUnit: "second", timeZone: "Asia/Tokyo" })?.hour // 9
 * @example unixWallClock(45870000, { timeZone: "-00:44:30" })?.toString() // "1970-01-01T12:00:00"
 * @example unixWallClock(0, { timeZone: "Asia/Tokio" }) // null
 */
export function unixWallClock(
  value: unknown,
  options?: { epochUnit?: unknown; timeZone?: unknown },
): Temporal.PlainDateTime | null {
  const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
  const frame = normalizeZoneFrame(options?.timeZone);

  if (epochUnit === null || frame === null) {
    return null;
  }

  try {
    const instant = unixEpochToInstant(value, epochUnit);

    return instant === null ? null : frameWallClock(instant, frame);
  } catch {
    return null;
  }
}

/**
 * The core of `parseUnitFromUnix` and the `parse*FromUnix` accessors: one field of a Unix epoch's
 * local wall clock, as a zero-padded string. Never throws.
 *
 * @param value Unix epoch number or digit string
 * @param unit the field to read
 * @param options already-checked `{ epochUnit, timeZone, weekStartsOn }`
 * @returns the field, or `""` when `value`, `unit` or an option is invalid
 *
 * @example unixUnitString(0, "year", {}) // "1970"
 * @example unixUnitString(0, "fortnight", {}) // ""
 */
export function unixUnitString(
  value: unknown,
  unit: unknown,
  options:
    | { epochUnit?: unknown; timeZone?: unknown; weekStartsOn?: unknown }
    | undefined,
): string {
  try {
    const wallClock = unixWallClock(value, options);
    const weekStartsOn = resolveWeekStartsOn(options?.weekStartsOn);

    if (
      wallClock === null ||
      typeof unit !== "string" ||
      weekStartsOn === null
    ) {
      return "";
    }

    try {
      switch (resolveDateTimeUnit(unit)) {
        case "year":
          return isoYearString(wallClock.year);
        case "month":
          return wallClock.month.toString().padStart(2, "0");
        case "week": {
          return (
            weekNumberOf(wallClock.toPlainDate(), weekStartsOn) ?? 0
          ).toString();
        }
        case "day":
          return wallClock.day.toString().padStart(2, "0");
        case "dayOfWeek":
          return wallClock.dayOfWeek.toString();
        case "hour":
          return wallClock.hour.toString().padStart(2, "0");
        case "minute":
          return wallClock.minute.toString().padStart(2, "0");
        case "second":
          return wallClock.second.toString().padStart(2, "0");
        case "millisecond":
          return wallClock.millisecond.toString().padStart(3, "0");
        case "microsecond":
          return wallClock.microsecond.toString().padStart(3, "0");
        case "nanosecond":
          return wallClock.nanosecond.toString().padStart(3, "0");
        default:
          return "";
      }
    } catch {
      return "";
    }
  } catch {
    return "";
  }
}
