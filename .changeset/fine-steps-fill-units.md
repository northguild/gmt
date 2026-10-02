---
"@northguild/gmt": patch
---

Stop `splitIntervalByUnitUnix` returning empty or repeated pieces when the step is finer than the epoch unit, and always end the last piece of `splitIntervalByUnitZoned` at the `end` you passed.

**A step finer than the epoch unit.** Boundaries are floored to whole seconds or milliseconds, so several finer steps used to floor to the same value and come back as empty pieces. Such a split now returns one piece per epoch unit, and `maxPieces` counts those pieces rather than the finer steps.

```typescript
import { splitIntervalByUnitUnix } from "@northguild/gmt";

splitIntervalByUnitUnix(0, 2, "millisecond", 500, { epochUnit: "seconds" });
// was [{ start: 0, end: 0 }, { start: 0, end: 1 }, { start: 1, end: 1 }, { start: 1, end: 2 }]
// now [{ start: 0, end: 1 }, { start: 1, end: 2 }]

splitIntervalByUnitUnix(0, 1, "microsecond", 500);
// was [{ start: 0, end: 0 }, { start: 0, end: 1 }]
// now [{ start: 0, end: 1 }]

splitIntervalByUnitUnix(0, 2000, "millisecond", 1, { epochUnit: "seconds" }).length;
// was 0 (2,000,000 steps passed the default limit), now 2000
```

A step of one epoch unit or more is unchanged.

**`start` and `end` in different zones.** When the last step landed exactly on `end`, `splitIntervalByUnitZoned` wrote that last boundary in `start`'s zone. It now returns the `end` argument in its own zone, as it already did when the last step passed `end`.

```typescript
import { splitIntervalByUnitZoned } from "@northguild/gmt";

splitIntervalByUnitZoned(
  "2024-01-01T00:00:00-05:00[America/New_York]",
  "2024-01-01T11:00:00+00:00[Europe/London]",
  "hour",
  3,
).at(-1)?.end;
// was "2024-01-01T06:00:00-05:00[America/New_York]" — the same instant
// now "2024-01-01T11:00:00+00:00[Europe/London]"
```
