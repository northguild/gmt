import type { Temporal } from "@js-temporal/polyfill";

/**
 * What to do when the UTC offset written in a zoned value disagrees with its time zone, as
 * Temporal's `offset` option (`Temporal.ZonedDateTime.prototype.with(item, { offset })`). It is
 * used alongside `Disambiguation`.
 *
 * `"use"` keeps the instant the offset names, `"ignore"` keeps the wall time and takes the offset
 * from the zone, `"prefer"` keeps the offset when it is valid for the zone and otherwise takes
 * the zone's, and `"reject"` refuses the mismatch.
 */
export type Offset = Temporal.ZonedDateTimeAssignmentOptions["offset"];
