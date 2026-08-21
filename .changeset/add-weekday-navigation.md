---
"@burglekitt/gmt": minor
---

Add weekday navigation: `nextWeekday`, `previousWeekday` (Story J7).

Each function finds the next/previous occurrence of a given ISO day of week (1 = Monday … 7 = Sunday, matching `getDayOfWeek`/`parseDayOfWeekFromDate`) on or after/before a date. Per Decision 5 in `context/roadmap/issues/J.md`, GMT ships two parameterized functions rather than date-fns's sixteen `nextMonday`…`previousSunday` functions; each function's JSDoc carries the full date-fns mapping table.

**`options.inclusive`** (default `false`) controls what happens when the input already falls on the target day: `false` advances/retreats a full week, matching date-fns's behavior; `true` returns the input as-is. This default is easy to get surprised by — `nextWeekday("2024-03-15", 5)` on a date that *is* already a Friday returns the following Friday, not the input — so it's called out explicitly in both functions' JSDoc and the `compare-dates` skill's Common Mistakes.

date-fns's `lastDayOfMonth` is not a gap this pair fills — it's already covered by GMT's existing `endOfDate(value, "month")`.
