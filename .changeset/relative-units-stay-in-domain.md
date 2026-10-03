---
"@northguild/gmt": minor
---

Return `""` from the `formatRelative*` functions for a `largestUnit` their type does not list.

Each function lists the units its values have: `formatRelativeDate` the date units, `formatRelativeTime` the time units, and the other four all seven. The type already rejected any other unit, but at run time `formatRelativeDate` wrote a date distance in hours and `formatRelativeTime` accepted `"day"`. Temporal throws `RangeError` for a unit outside the units of the type: `Temporal.PlainDate.prototype.until` rejects `largestUnit: "hour"`, and `Temporal.PlainTime.prototype.until` rejects `"day"`. The functions now follow that rule and return `""`.

One rule here is GMT's own and stricter than Temporal: a `largestUnit` that is not a string returns `""`. Temporal converts any value to a string first, so it accepts `["day"]` and an object whose `toString` returns `"day"`. GMT takes string inputs, and its other functions that check a unit (`roundDate`, `roundDateTime`, `roundUtc`, `roundZoned`, `startOfDate`, `durationAs`, `areDatesEqualBy`) already reject a value that is not a string, so the `formatRelative*` functions now do too.

| Function | `largestUnit` accepts, singular or plural |
| --- | --- |
| `formatRelativeDate` | `"day"`, `"week"`, `"month"`, `"year"` |
| `formatRelativeTime` | `"second"`, `"minute"`, `"hour"` |
| `formatRelativeDateTime`, `formatRelativeUtc`, `formatRelativeUnix`, `formatRelativeZoned` | `"second"`, `"minute"`, `"hour"`, `"day"`, `"week"`, `"month"`, `"year"` |

A listed unit, singular or plural, formats as before. An omitted `largestUnit`, or one passed as `undefined`, still picks the unit from the distance.

### Breaking changes

| Call | 1.17 | 1.18 |
| --- | --- | --- |
| `formatRelativeDate("2024-01-03", "en-US", { reference: "2024-01-01", largestUnit: "hour" })`, likewise `"hours"` | `"in 48 hours"` | `""` |
| The same call with `"minute"` or `"minutes"` | `"in 2,880 minutes"` | `""` |
| The same call with `"second"` or `"seconds"` | `"in 172,800 seconds"` | `""` |
| `formatRelativeTime("05:00", "en-US", { reference: "00:00", largestUnit: "day" })`, likewise `"days"` | `"today"` | `""` |
| Any of the six functions with a `largestUnit` that is not a string, such as `["day"]` or an object whose `toString` returns `"day"` (GMT's rule; Temporal accepts these) | The value was converted to a string and formatted, for example `"in 2 days"` | `""` |

TypeScript already rejected each of these calls, so only untyped callers and `as never` casts are affected.

To write a date distance in a time unit, give both dates a time and call `formatRelativeDateTime`:

```typescript
import { formatRelativeDateTime } from "@northguild/gmt";

formatRelativeDateTime("2024-01-03T00:00:00", "en-US", {
  reference: "2024-01-01T00:00:00",
  largestUnit: "hour",
}); // "in 48 hours"
```
