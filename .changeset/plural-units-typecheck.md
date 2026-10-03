---
"@northguild/gmt": patch
---

Accept plural unit names in the type of the `largestUnit` option of the `formatRelative*` functions, not only at run time.

`formatRelativeUnix` already typed `largestUnit` as singular or plural. The other five functions accepted `"hours"` when called from JavaScript but rejected it in TypeScript. Their types now accept the plural of every unit they already listed:

| Function | `largestUnit` now also accepts |
| --- | --- |
| `formatRelativeUtc`, `formatRelativeZoned`, `formatRelativeDateTime` | `"years"`, `"months"`, `"weeks"`, `"days"`, `"hours"`, `"minutes"`, `"seconds"` |
| `formatRelativeDate` | `"years"`, `"months"`, `"weeks"`, `"days"` |
| `formatRelativeTime` | `"hours"`, `"minutes"`, `"seconds"` |

```typescript
import { formatRelativeUtc } from "@northguild/gmt";

const reference = "2024-03-17T12:00:00Z";

formatRelativeUtc("2024-03-17T10:00:00Z", "en-US", { reference, largestUnit: "hour" }); // "2 hours ago", unchanged
formatRelativeUtc("2024-03-17T10:00:00Z", "en-US", { reference, largestUnit: "hours" }); // "2 hours ago" — was a type error
```

No output changes: a plural names the same unit as its singular, as it does in `Intl.RelativeTimeFormat` and Temporal.
