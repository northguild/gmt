import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { unixZonedDateTime } from "../../internal/unixZonedDateTime";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the week number from a unix epoch value.
 *
 * - Returns the week of the week-year, 1–53, so late-December days can be week 1 of the next
 *   year — see `getWeekNumber`.
 * - Returns null for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: how `value` is read, the zone its date is read in and the first day of the week; a non-object value (such as `null`) is invalid
 * @returns Week number (1-53 for "monday" and for "sunday") or null on invalid input
 *
 * @example parseWeekFromUnix(1704067200000, { timeZone: "UTC" }) // 1
 * @example parseWeekFromUnix(1704067200000, { weekStartsOn: "sunday", timeZone: "UTC" }) // 1
 * @example parseWeekFromUnix(-86400, { epochUnit: "seconds" }) // 1
 * @example parseWeekFromUnix("1704067200000") // 1 (digit string, UTC by default)
 * @example parseWeekFromUnix("") // null (a blank string is not epoch 0)
 * @example parseWeekFromUnix(1735646400000, { weekStartsOn: "sunday", timeZone: "UTC" }) // 1 (2024-12-31T12:00:00Z; its Sunday-first week holds 1 January 2025)
 */
export function parseWeekFromUnix(
  value: number | string,
  options?: {
    /**
     * The unit the epoch values are counted in: `"seconds"` or `"milliseconds"`, singular or
     * plural. Any other value returns `null`.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
    /**
     * The time zone the date is read in: an IANA name, a UTC offset, or `"local"` for the system
     * time zone. An unknown zone returns `null`.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
    /**
     * The first day of the week, which sets how the week is numbered. `"monday"` gives the ISO 8601
     * week number, where week 1 holds the year's first Thursday; `"sunday"` gives the UTS #35 week
     * number with a Sunday first day and one minimal day, where week 1 holds 1 January. Any other
     * value returns `null`.
     *
     * @defaultValue `"monday"`
     */
    weekStartsOn?: "monday" | "sunday";
  },
): number | null {
  try {
    // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
    if (!isOptionsArgument(options)) {
      return null;
    }
    const zdt = unixZonedDateTime(value, options);
    const weekStartsOn = resolveWeekStartsOn(options?.weekStartsOn);

    if (zdt === null || weekStartsOn === null) return null;

    try {
      return getWeekNumber(zdt.toPlainDate().toString(), weekStartsOn);
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
