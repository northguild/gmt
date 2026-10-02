---
"@northguild/gmt": patch
---

Accept `timeStyle: "long"` in the type of `formatCalendarUtc`, `formatCalendarUnix` and `formatCalendarZoned`, not only at run time.

`timeStyle` is the `timeStyle` of `Intl.DateTimeFormat`, which takes `"short"`, `"medium"`, `"long"` and `"full"`. The three functions formatted `"long"` when called from JavaScript but rejected it in TypeScript.

```typescript
import { formatCalendarUtc } from "@northguild/gmt";

formatCalendarUtc("2024-03-16T18:30:00Z", "en-US", {
  reference: "2024-03-15T13:00:00Z",
  timeStyle: "long",
}); // "tomorrow at 6:30:00 PM UTC" — was a type error
```

No output changes. `formatCalendar` is unchanged: a plain date-time has no time zone, so its type offers `"short"` and `"medium"` only.
