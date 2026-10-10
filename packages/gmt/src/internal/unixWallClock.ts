import type { Temporal } from "@js-temporal/polyfill";
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
