---
"@burglekitt/gmt": minor
---

Adds relative time formatters across all value types, and fills in the missing base formatters for the unix and utc namespaces.

New relative formatters — all accept `locale`, `style` (`"long" | "short" | "narrow"`), `numeric` (`"auto" | "always"`), `largestUnit`, and an optional `reference` anchor; auto-select the largest sensible unit when `largestUnit` is omitted; return `""` for invalid input:

- `formatRelativeDate` — relative plain date (e.g. `"3 days ago"`, `"next year"`)
- `formatRelativeTime` — relative plain time (e.g. `"30 minutes ago"`)
- `formatRelativeDateTime` — relative plain datetime (e.g. `"in 2 hours"`)
- `formatRelativeZoned` — relative zoned datetime, DST-safe; reference can be a `ZonedDateTime` string, UTC string, or Unix epoch (ms)
- `formatRelativeUnix` — relative time from a Unix epoch (ms or seconds); reference can be a numeric epoch or UTC ISO string
- `formatRelativeUtc` — relative time from a UTC ISO string

New base formatters:

- `formatUnix` — locale-aware formatting for Unix epochs (ms or seconds); accepts `timeZone` (including `"local"`) and `includeTimeZoneName`
- `formatUtc` — locale-aware formatting for UTC ISO strings; accepts `timeZone` and `includeTimeZoneName`
