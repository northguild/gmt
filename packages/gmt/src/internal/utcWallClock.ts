import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../utc/validate/isValidUtc";
import { frameWallClock, normalizeZoneFrame } from "./zoneFrame";

/**
 * Read a UTC ISO string on a local wall clock for the `parse*FromUtc` accessors: the instant it
 * names, on the wall clock of `options.timeZone`. The utc twin of `unixWallClock`.
 *
 * - `timeZone` defaults to `"UTC"`; `"local"` is the system zone; a time zone identifier or a
 *   stored UTC offset (`±HH:MM[:SS]`) is read as written; anything else is invalid (see
 *   `normalizeZoneFrame`).
 *
 * @param value UTC ISO 8601 datetime string
 * @param options optional `{ timeZone }`
 * @returns the local wall clock, or null when the value or the zone is invalid
 * @example utcWallClock("2024-03-15T14:30:00Z", { timeZone: "Asia/Tokyo" })?.toString() // "2024-03-15T23:30:00"
 * @example utcWallClock("1970-01-01T12:44:30Z", { timeZone: "-00:44:30" })?.toString() // "1970-01-01T12:00:00"
 * @example utcWallClock("2024-03-15T14:30:00Z", { timeZone: "Invalid/Zone" }) // null
 * @example utcWallClock("2024-03-15T14:30:00") // null (no Z)
 */
export function utcWallClock(
  value: string,
  options?: { timeZone?: string },
): Temporal.PlainDateTime | null {
  if (!isValidUtc(value)) return null;

  const frame = normalizeZoneFrame(options?.timeZone);
  if (frame === null) return null;

  try {
    return frameWallClock(Temporal.Instant.from(value), frame);
  } catch {
    return null;
  }
}
