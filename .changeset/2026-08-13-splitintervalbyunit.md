---
"@burglekitt/gmt": minor
---

Add `splitIntervalByUnit*` functions across plain, utc, unix, and zoned namespaces.

- `splitIntervalByUnitDate`, `splitIntervalByUnitTime`, `splitIntervalByUnitDateTime` (plain) — split an interval into sub-intervals of `amount × unit`, returning an array of `{ start, end }` records.
- `splitIntervalByUnitUtc`, `splitIntervalByUnitUnix`, `splitIntervalByUnitZoned` (utc, unix, zoned) — same pattern adapted to each Temporal environment.

All functions return `[]` on invalid input (never throw). The final sub-interval is trimmed so its `end` never exceeds the original `end`.
