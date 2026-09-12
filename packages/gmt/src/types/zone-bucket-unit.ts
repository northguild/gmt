/**
 * Units `floorToZone` and `bucketRange` floor an instant to, in a target time zone.
 *
 * Narrower than `DateTimeUnit` on purpose: these are the boundaries a calendar in a zone
 * actually has. Sub-hour units need no zone (a minute boundary is the same instant
 * everywhere a zone's offset is a whole minute), and `year` is left out because the fiscal
 * and calendar year questions are `getFiscalPeriod`'s and `getQuarter`'s.
 *
 * Narrow a candidate unit with `isValidZoneBucketUnit`.
 */
export type ZoneBucketUnit = "hour" | "day" | "week" | "month";
