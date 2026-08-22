---
"@burglekitt/gmt": minor
---

Add interval length and partitioning: `intervalLength*`, `intervalDivideEqually*`, `intervalSplitAt*`, `mergeIntervals*`, `intervalXorAll*` across `Date`/`DateTime`/`Time`/`Zoned`/`Unix`/`Utc` (Story J9).

`intervalLength*` is `intervalCount*`'s exact-duration counterpart — it answers "how long is this interval" as a real, possibly fractional number via `Temporal.Duration.prototype.total`, rather than "how many `unit` boundaries does it touch". The same interval from `23:59` to `00:01` is `2` day boundaries via `intervalCountDateTime` but `~0.0014` days via `intervalLengthDateTime`. Zoned/Unix/Utc variants are DST-aware the same way `intervalCount*` is.

`intervalDivideEqually*` splits an interval into `n` equal-length sub-intervals; `intervalSplitAt*` splits at arbitrary (unsorted, out-of-range-safe) points instead of by count. `PlainDate` rounds internal boundaries to the nearest whole day since it has no fractional-day representation; every other variant is exact, computed from total elapsed nanoseconds — `intervalDivideEquallyZoned` splits DST-crossing intervals by real elapsed time, not local clock time.

`mergeIntervals*` and `intervalXorAll*` are the list-form generalizations of the existing pairwise `intervalUnion*` (B5) and `intervalXor*` (B7) — each takes a single array of `{ start, end }` records instead of two flat intervals. `intervalXorAll*` is implemented as a coverage sweep and reduces to the pairwise `intervalXor*` result for exactly two intervals.

Updated `packages/gmt/README.md`, all four namespace READMEs (`plain`/`zoned`/`unix`/`utc`), and the `interval-ops` skill (new Core Patterns plus two Common Mistakes entries, including the required `intervalLength` vs `intervalCount` distinction).
