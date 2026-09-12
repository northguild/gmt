import type { ZoneBucketUnit } from "../../types";

/**
 * Return true when `unit` is a valid ZoneBucketUnit.
 *
 * - Valid units are: "hour", "day", "week", "month".
 * - Accepts any input type and returns false for non-string values.
 * - Uses type assertion to narrow the type.
 * - Narrower than `isValidDateTimeUnit` on purpose: these are the boundaries a calendar in a
 *   zone actually has. Sub-hour units need no zone, and "year" is left out because the
 *   calendar and fiscal year questions are `getQuarter`'s and `getFiscalPeriod`'s.
 * - `floorToZone` returns "" and `bucketRange` returns [] for a unit they do not recognise —
 *   the same sentinels they return for an unusable instant. Check the unit here to tell a
 *   misconfigured rollup apart from a bad timestamp.
 *
 * @param unit candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidZoneBucketUnit("hour") // true
 * @example isValidZoneBucketUnit("day") // true
 * @example isValidZoneBucketUnit("week") // true
 * @example isValidZoneBucketUnit("month") // true
 * @example isValidZoneBucketUnit("year") // false (a calendar year is getQuarter's question)
 * @example isValidZoneBucketUnit("minute") // false (a sub-hour boundary needs no zone)
 * @example isValidZoneBucketUnit("days") // false
 * @example isValidZoneBucketUnit(1) // false
 * @example isValidZoneBucketUnit(null) // false
 */
export function isValidZoneBucketUnit(unit: unknown): unit is ZoneBucketUnit {
  if (typeof unit !== "string") {
    return false;
  }

  return (
    unit === "hour" || unit === "day" || unit === "week" || unit === "month"
  );
}
