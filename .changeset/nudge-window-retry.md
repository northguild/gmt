---
"@northguild/gmt": patch
---

Fix lengths, rounding and differences in months or years measured from the 29th, 30th or 31st (Story CORE-8).

**Which functions.** `intervalLengthDate`, `intervalLengthDateTime`, `intervalLengthUtc`, `intervalLengthZoned`, `intervalLengthUnix`, `formatRelativeDate`, `formatRelativeDateTime`, `normalizeDuration`, and the `diff*` functions that carry a time component — `diffDateTime`, `diffUtc`, `diffUnix` and `diffZoned` — given a `smallestUnit` of months or years. `diffDate` is not affected: two dates have no time component, so the bracket always closes on a date it already reaches.

**What was wrong.** A month has no fixed length, so measuring one means bracketing the span between two dates a month apart. Temporal checks that the answer actually falls inside that bracket and moves it along when it does not. `@js-temporal/polyfill` 0.5.1 skips that check, so any measurement from the 29th, 30th or 31st — the days where adding a month has to clamp — could be taken against the wrong pair of dates.

```typescript
import { diffDateTime, intervalLengthDateTime, normalizeDuration } from "@northguild/gmt";

diffDateTime("2024-01-31T00:00:00", "2024-02-29T12:00:00", ["months"], { smallestUnit: "months", roundingMode: "floor" });
// { months: 1 } — was { months: 0 }, a whole month short

normalizeDuration("P30DT12H", { smallestUnit: "month", roundingMode: "floor", relativeTo: "2024-01-30" });
// "P1M" — was "PT0S"

intervalLengthDateTime("2024-01-31T00:00:00", "2024-02-29T12:00:00", "month");
// 1.0161290322580645 — was 1.0172413793103448
```

Differences without a `smallestUnit` were always right, and so was every whole part: only a measurement that had to round, or report a fraction, was affected.

**Rounding exactly on a boundary.** Separately, `ceil` treated a span that lands exactly on a whole month as needing another one — `P60D` from `2024-01-31` rounded to `P3M` instead of `P2M`. A span that is already a whole number of months now stays as it is, in every calendar.

**How it is fixed.** GMT already owns the TC39 algorithm, for the non-ISO calendars the polyfill also gets wrong; these operations now take that path. Every one of 24,916 scanned cases matches the Temporal built into Chrome 153 exactly. The workaround is behind a probe (compat defect `D11`) and stops running by itself once a polyfill release carries the upstream fix — the answers do not change when it does.
