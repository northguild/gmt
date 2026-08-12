---
"@burglekitt/gmt": minor
---

Add interval and range validators across plain, utc, unix, and zoned namespaces.

- `isValidDateInterval`, `isValidTimeInterval`, `isValidDateTimeInterval` (plain) — positional `(start, end)` args returning `true` when both parse and `start <= end`.
- `isValidUtcInterval`, `isValidUnixInterval`, `isValidZonedInterval` (utc, unix, zoned) — same pattern, comparing by instant for utc/zoned.
- `isValidDateTimeRange`, `isValidTimeRange` (plain), `isValidUtcRange`, `isValidUnixRange`, `isValidZonedRange` (utc, unix, zoned) — object-param `{ value1, value2 }` shape matching the existing `isValidDateRange` convention.

All functions return `false` on invalid input (never throw).
