---
"@burglekitt/gmt": minor
---

Add `intervalsOverlapDate`, `intervalsOverlapTime`, `intervalsOverlapDateTime`
(plain), `intervalsOverlapUtc` (utc), `intervalsOverlapUnix` (unix), and
`intervalsOverlapZoned` (zoned) — interval overlap detection. Each accepts two
intervals and returns `true` when they share at least one instant:

- Adjacent intervals (e.g. `aEnd === bStart`) are treated as overlapping because
  they share the boundary instant.
- Returns `false` when intervals are disjoint with a gap, or when either interval
  is invalid (`start > end`).
- Returns `false` on malformed input (never throws).
