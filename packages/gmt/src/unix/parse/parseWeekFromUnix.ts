import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { resolveWeekStartsOn } from "../../internal/resolveWeekStartsOn";
import { unixZonedDateTime } from "../../internal/unixZonedDateTime";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the week number from a unix epoch value.
 *
 * - `"monday"` (default) is the ISO 8601 week of the week-year: week 1 is the week containing the
 *   first Thursday, so late-December days can be week 1 of the next year. The result is 1–53.
 * - `"sunday"` is the UTS #35 week of the week-year with a Sunday first day and minimal days 1:
 *   week 1 is the Sunday-first week holding 1 January, so late-December days can be week 1 of the
 *   next year. The result is 1–53 — see `getWeekNumber`.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns null.
 * - Returns null for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC"; an unknown zone is invalid), weekStartsOn ("monday" | "sunday"); a non-object value (such as `null`) is invalid
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
    epochUnit?: UnixUnit;
    timeZone?: string;
    weekStartsOn?: "monday" | "sunday";
  },
): number | null {
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
}
