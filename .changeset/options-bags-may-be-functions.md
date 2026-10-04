---
"@northguild/gmt": patch
---

Accept a function as an options bag or an object argument, as Temporal and `Intl` do.

ECMA-262's GetOptionsObject accepts any Object, and a function is an Object: Temporal reads `Object.assign(() => 0, { largestUnit: "hours" })` as `{ largestUnit: "hours" }`. GMT checked `typeof options === "object"`, so every function that takes options returned its sentinel for one. The same narrow check refused a function as a property bag or record: the `units` of `addDate` and its siblings, a `relativeTo` property bag, an interval, a leg, a business calendar, an operating schedule, a punctuality pair.

```typescript
import { addDate, convertUtcToPlainDate } from "@northguild/gmt";

convertUtcToPlainDate("2024-02-29T00:00:00Z", Object.assign(() => 0, { timeZone: "America/New_York" }));
// "2024-02-28", as with { timeZone: "America/New_York" }; it was ""

addDate("2024-01-31", Object.assign(() => 0, { months: 1 })); // "2024-02-29"; it was ""
```

- Every options bag, property bag and record argument is checked by one helper that accepts any Object, functions included. `null`, strings, numbers, booleans, symbols and bigints are still refused with the function's sentinel.
- An operating schedule's `weekly` record now reads only its enumerable keys, as `Object.assign` and spread copy them, so a function's built-in `length` and `name` are not read as unknown weekdays. A non-enumerable weekday key is ignored rather than read.
- A member is read with an ordinary property get, as Temporal's GetOption reads one. A `cutoffSchedule` entry written as a function is therefore labelled with the function's own `name` (`""` for an anonymous one), as `{ name: "", offset }` is.
