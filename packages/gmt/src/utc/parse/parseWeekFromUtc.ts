import { Temporal } from "@js-temporal/polyfill";
import { frameWallClock, normalizeZoneFrame } from "../../internal/zoneFrame";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { isValidUtc } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the week number from a UTC datetime string.
 *
 * - The result is the week of the week-year, 1–53, so late-December days can be week 1 of the next
 *   year: 2024-12-31 → 1 under either numbering, and 2000-12-30 → 53 under the Sunday-first one
 *   (minimal days 1).
 * - Returns null for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param optionsArg How weeks are numbered, and the time zone the value is read in
 * @returns Week number (1-53), or null on invalid input
 *
 * @example parseWeekFromUtc("2024-03-17T14:30:45Z") // 11
 * @example parseWeekFromUtc("2024-12-31T12:00:00Z") // 1 (ISO week 1 of 2025)
 * @example parseWeekFromUtc("2024-12-31T12:00:00Z", { weekStartsOn: "sunday" }) // 1 (its Sunday-first week holds 1 January 2025)
 * @example parseWeekFromUtc("2000-12-31T12:00:00Z", { weekStartsOn: "sunday" }) // 1 (its Sunday-first week holds 1 January 2001)
 * @example parseWeekFromUtc("2024-03-17T02:30:45Z", { weekStartsOn: "sunday", timeZone: "America/New_York" }) // 11 (Saturday 16 March in New York)
 * @example parseWeekFromUtc("invalid") // null
 */
export function parseWeekFromUtc(
  value: string,
  optionsArg?: {
    /**
     * The first day of the week, which sets how the week is numbered. `"monday"` gives the ISO 8601
     * week number, where week 1 holds the year's first Thursday; `"sunday"` gives the UTS #35 week
     * number with a Sunday first day and one minimal day, where week 1 holds 1 January. Any other
     * value returns `null`.
     *
     * @defaultValue `"monday"`
     */
    weekStartsOn?: "monday" | "sunday";
    /**
     * The time zone the wall-clock fields are read in: an IANA name, a UTC offset (a time zone
     * identifier such as `+05:30`, `+0530` or `-08`, or a stored offset `±HH:MM[:SS]`, what
     * `getTimeZoneOffset` returns), or `"local"` for the system time zone. An unknown zone returns
     * `null`.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
  },
): number | null {
  try {
    if (!isOptionsArgument(optionsArg)) {
      return null;
    }

    if (!isValidUtc(value)) return null;

    const weekStartsOn = resolveWeekStartsOn(optionsArg?.weekStartsOn);
    const frame = normalizeZoneFrame(optionsArg?.timeZone);
    if (weekStartsOn === null || frame === null) return null;

    try {
      const instant = Temporal.Instant.from(value);
      const dt = frameWallClock(instant, frame);
      const dateStr = dt.toPlainDate().toString();
      return getWeekNumber(dateStr, weekStartsOn);
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
