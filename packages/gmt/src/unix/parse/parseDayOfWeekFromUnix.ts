import { unixZonedDateTime } from "../../internal/unixZonedDateTime";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the day of week (1-7) from a unix epoch value.
 *
 * - Monday=1 through Sunday=7.
 * - Returns null for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"; an unknown zone is invalid)
 * @returns Day of week (1-7) or null on invalid input
 *
 * @example parseDayOfWeekFromUnix(1704067200000, { timeZone: "UTC" }) // 1
 * @example parseDayOfWeekFromUnix(-86400, { epochUnit: "seconds", timeZone: "UTC" }) // 3
 * @example parseDayOfWeekFromUnix("1704067200000") // 1 (digit string, UTC by default)
 * @example parseDayOfWeekFromUnix(" 1704067200000") // null (a padded string is not an epoch)
 * @example parseDayOfWeekFromUnix("") // null (a blank string is not epoch 0)
 */
export function parseDayOfWeekFromUnix(
  value: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): number | null {
  if (!isOptionsArgument(options)) {
    return null;
  }

  return unixZonedDateTime(value, options)?.dayOfWeek ?? null;
}
