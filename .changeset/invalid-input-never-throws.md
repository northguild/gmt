---
"@northguild/gmt": patch
---

Stop 62 functions throwing on a missing or wrong-typed argument (Story CORE-8). Each now returns its documented invalid-input result.

GMT's contract is that invalid input returns `""`, `null`, `false` or `[]` and never throws. These functions broke it with a `TypeError` or `RangeError` from inside the function:

- `addDate`, `subtractDate` and the other `add*`/`subtract*` functions, given a `null` duration
- `roundDate`, `roundTime` and the other `round*` functions, with no options
- `min*`, `max*`, `sort*`, `closestDateTo` and `closestZonedTo`, given something that is not an array
- `getLargestDateDurationUnit`, `getLargestDateTimeDurationUnit` and `getLargestTimeDurationUnit`, given `null` or a non-array, which now return `""`
- the ten `formatRelative*` and `formatCalendar*` functions, given `options = null`
- the six `isValid*Range` validators, given `null` or `undefined`

```typescript
import { addDate, cycleDate, isValidDateRange, minDate, minUnix, roundTime } from "@northguild/gmt";

addDate("2024-01-01", null); // ""
roundTime("12:34:56"); // ""
minDate("2024-01-01"); // null
isValidDateRange(null); // false
```

`options = null` in the relative and calendar formatters returns `""`, since Temporal's `GetOptionsObject` rejects it. This release applies the same rule to every function that takes an options object.

**`cycle*` amounts.** `cycleDate`, `cycleDateTime`, `cycleTime` and `cycleZoned` read `null`, `""`, `[]` and `true` as an amount of `0` and returned the value unchanged. They now return `""`.

```typescript
cycleDate("2024-12-15", "month", null); // ""
```

**`minUnix` and `maxUnix` on long arrays.** They spread the array into one call, so around 200,000 values overflowed the stack. They now scan the array.

```typescript
minUnix(Array.from({ length: 200000 }, (_, i) => i * 1000)); // 0
```

A new test feeds invalid values to every exported function in every argument position and checks that it returns its declared sentinel. No valid input changes output in this entry.
