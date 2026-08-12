---
"@burglekitt/gmt": minor
---

Add `intervalIntersectionDate`, `intervalIntersectionTime`, `intervalIntersectionDateTime`
(plain), `intervalIntersectionUtc` (utc), `intervalIntersectionUnix` (unix), and
`intervalIntersectionZoned` (zoned) — interval intersection. Each accepts two
intervals and returns the overlapping span, or `null` when they do not overlap:

- Adjacent intervals (e.g. `aEnd === bStart`) share one instant and DO overlap,
  returning a single-point span.
- Returns `null` when intervals are disjoint with a gap, or when either interval
  is invalid (`start > end`).
- Returns `null` on malformed input (never throws).
- Return shape: `{ start: string; end: string } | null` (or `{ start: number;
  end: number } | null` for Unix).
