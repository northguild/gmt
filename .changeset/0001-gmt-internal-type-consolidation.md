---
"@northguild/gmt": patch
---

Internal type consolidation: extract shared option properties into base types (`CalendarOptions`, `RelativeTimeFormatOptions`, `DateTimeFormatOptions`) to reduce duplication across plain/unix/utc/zoned formatters. Convert all remaining `//` comments in `packages/gmt/src/regex/` to JSDoc style with `@example` blocks, and add missing JSDoc to `time-zone-like.ts` and `unix.ts`.
