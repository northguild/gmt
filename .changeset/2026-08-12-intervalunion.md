---
"@burglekitt/gmt": minor
---

Adds `intervalUnionDate`, `intervalUnionTime`, `intervalUnionDateTime` (plain), `intervalUnionUtc` (utc), `intervalUnionUnix` (unix), and `intervalUnionZoned` (zoned) — merge two intervals into their combined span when they overlap or are directly adjacent.

- Overlapping or adjacent intervals return `{ start, end }` with the merged span. Adjacent intervals (e.g. `aEnd === bStart`) share one instant and ARE merged.
- Returns `null` when intervals are disjoint with a gap, when either interval is invalid (`start > end`), or on malformed input (never throws).
- Return shape: `{ start: string; end: string } | null` for plain/utc/zoned; `{ start: number; end: number } | null` for Unix.
