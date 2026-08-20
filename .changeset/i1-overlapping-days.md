---
"@burglekitt/gmt": minor
---

Add `intervalOverlappingDays*` — the number of distinct calendar days two intervals share (Story I1):

- `intervalOverlappingDaysDate`, `intervalOverlappingDaysDateTime`, `intervalOverlappingDaysZoned`, `intervalOverlappingDaysUnix`, `intervalOverlappingDaysUtc`

Returns `0` when the intervals are disjoint and `null` on invalid input. Counting is inclusive of both endpoints, matching GMT's closed-interval model: `["2024-01-01", "2024-01-01"]` overlapping itself is `1` day, not `0`. This differs from date-fns's `getOverlappingDaysInIntervals`, which rounds up elapsed 24-hour periods instead — compose `intervalCount*` over `intervalIntersection*`'s result for that behavior. There is no `Time` variant: `PlainTime` has no calendar.
