import type { Temporal } from "@js-temporal/polyfill";

// used alongside disambiguation in Temporal with()/from() methods like Temporal.ZonedDateTime.prototype.with(item, { disambiguation, offset })
export type Offset = Temporal.ZonedDateTimeAssignmentOptions["offset"];
