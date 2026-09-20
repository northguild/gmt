---
"@northguild/gmt": patch
---

Fix the fractional part of a length in months when the interval starts on the 29th, 30th or 31st (Story CORE-8).

**Which functions.** `intervalLengthDate`, `intervalLengthDateTime`, `intervalLengthUtc`, `intervalLengthZoned`, `intervalLengthUnix`, `formatRelativeDate` and `formatRelativeDateTime` — anything that measures a span in months or years from a start date whose day can be pushed back when a month is added.

**What was wrong.** A month has no fixed length, so a fractional month is the leftover divided by the length of a month. Temporal divides by the month the interval *ends* in. `@js-temporal/polyfill` 0.5.1 divides by the month before it, and the two differ exactly when adding a month to the start date has to constrain the day — January 31 plus a month is February 29, not February 31.

```typescript
import { intervalLengthDateTime } from "@northguild/gmt";

intervalLengthDateTime("2024-01-31T00:00:00", "2024-02-29T12:00:00", "month"); // 1.0161290322580645
// was 1.0172413793103448 — 12 hours over February's 29 days instead of over the following month's 31
```

The whole part was always right, and so was every difference (`diffDate`, `diffUtc`, …): only the fraction a length carries was affected.

**How it is fixed.** GMT already owns the TC39 `NudgeToCalendarUnit` algorithm, for the non-ISO calendars the polyfill also gets wrong. Month and year totals from a start past the 28th now take that path. Every one of 2,016 scanned cases matches the Temporal built into Chrome 153 exactly. The workaround is behind a probe (compat defect `D11`) and stops running by itself once a fixed polyfill ships — the answers do not change when it does.
