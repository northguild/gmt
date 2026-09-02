---
"@northguild/gmt": patch
---

Fix `@example` values and prose in `intervalDifferenceZoned` and `intervalXorZoned` JSDoc: the documented interior boundaries didn't match what the functions actually compute (they're re-derived at ±1 nanosecond from the overlap edges, never copied or rounded to the second). `intervalXorZoned`'s docs also incorrectly claimed full containment returns a single `{ start, end }` — it returns two. Added regression tests asserting the exact boundary strings so this can't drift silently again.
