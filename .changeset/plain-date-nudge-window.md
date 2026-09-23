---
"@northguild/gmt": patch
---

Stop routing ISO `PlainDate` differences through the D11 nudge-window workaround (Story CORE-8).

`diffDate` and `diffDateAsDuration` with a `smallestUnit` of months or years took GMT's own spec path when the start day was the 29th or later. That path exists for a polyfill defect the operation cannot reach: the nudge window only misses its target when the target sits strictly between the window bounds by a sub-day amount, and two `PlainDate`s have no time component, so the bound always lands on a date the window already reaches. Measured over about 1.96 million rows against the raw polyfill, in both directions and across every rounding mode and increment, the two paths never disagreed.

Answers are unchanged. What goes away is exposure: that path carries GMT's own exact-boundary rounding behaviour, and routing ISO through it widened a defect's reach for no corrected result. The workaround stays where the defect is real — `Duration#total`, `Duration#round`, and `until`/`since` with a time component.
