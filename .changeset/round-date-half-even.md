---
"@northguild/gmt": patch
---

Fix `halfEven` in `roundDate` and `roundDateTime`, which rounded ties the wrong way.

Both functions aliased `halfEven` to `halfExpand` for date units, so an exact tie rounded away from the unit start instead of towards the even multiple of the increment. `roundDate("2024-06-16", { smallestUnit: "month", roundingMode: "halfEven" })` returned `"2024-07-01"`; June 16 is 15 days into a 30-day month, an exact tie, so half-even rounds to `"2024-06-01"`. The same applied to `roundDateTime` on `"year"`, `"month"` and `"week"`.

The rounding grid is anchored at the unit containing the value: that unit's start is multiple 0 and the next start is multiple 1, so the even multiple at a tie is the current start. Values above and below the tie are unaffected, and every other rounding mode is unchanged. Both JSDoc blocks now state the anchor. Time units in `roundDateTime` were already correct — they round through Temporal.
