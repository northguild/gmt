---
"@burglekitt/gmt": minor
---

Add `intervalFromDuration`: `intervalFromDurationDate`, `intervalFromDurationDateTime`, `intervalFromDurationTime`, `intervalFromDurationUtc`, `intervalFromDurationUnix`, `intervalFromDurationZoned` — construct an interval from a single point plus an ISO 8601 duration, anchored at either `"start"` or `"end"` (Luxon's `Interval.after`/`Interval.before` as one function with an `anchor` param). Calendar units resolve against the point itself, no `relativeTo` needed — except `intervalFromDurationTime`, which returns `null` for a duration with a date-unit component, since `PlainTime` has no calendar to resolve it against. Returns `null` on invalid input, including a negative duration that inverts the computed span.
