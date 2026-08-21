---
"@burglekitt/gmt": minor
---

Add same-unit comparison: `areDatesEqualBy`, `areDateTimesEqualBy`, `areZonedEqualBy`, `areUnixEqualBy`, `areUtcEqualBy` (Story J5).

Each function answers "are these two values equal at a given calendar unit?" — `areDatesEqualBy(a, b, "month")` replaces the pattern of manually truncating both values before comparing. Per Decision 5 in `context/roadmap/issues/J.md`, GMT ships one parameterized function per namespace rather than date-fns's twelve `isSameX` functions; each function's JSDoc carries the full date-fns mapping table.

**Semantics, decided explicitly:** equality is measured by comparing the start-of-unit boundary for each value, so a unit implicitly requires every coarser unit above it to match too — `areDatesEqualBy("2023-03-15", "2024-03-15", "month")` is `false`, not `true`, because "same month" means the same month *and* year. This matches date-fns's `isSameMonth`/`isSameWeek`/etc. and Luxon's `dt.hasSame(other, unit)` (verified against date-fns's source), not a bare "same month-of-year across any year" comparison.

`areZonedEqualBy` compares each value's own local calendar fields in its own time zone, not the underlying instant or time zone identifier — two zoned values representing the same instant can land on different local calendar days depending on their zone, and vice versa.
