---
"@northguild/gmt": patch
---

Follow Temporal's zoned arithmetic and difference algorithms across DST changes (Story CORE-8).

**`addZoned`, `subtractZoned` and `intervalFromDurationZoned` keep exact time exact.** TC39 Temporal §6.5.5 AddZonedDateTime adds a duration's date part on the wall clock and its time part in exact time. With a `disambiguation` other than `"compatible"`, these functions re-resolved the final wall-clock time. Adding 10 minutes in a repeated hour could then land 50 minutes earlier. `disambiguation` now applies only to the wall-clock time the date part lands on: when a fall-back repeats that time, and when a spring-forward skips it. A date step into a skipped hour used to move forward whatever `disambiguation` said. A time-only duration ignores it.

```typescript
import { addZoned, setZoned } from "@northguild/gmt/zoned";

addZoned("2024-11-03T01:30:00-05:00[America/New_York]", { minutes: 10 }, { disambiguation: "earlier" });
// "2024-11-03T01:40:00-05:00[America/New_York]"
addZoned("2024-03-09T02:30:00-05:00[America/New_York]", { days: 1 }, { disambiguation: "earlier" });
// "2024-03-10T01:30:00-05:00[America/New_York]"
addZoned("2024-03-09T02:30:00-05:00[America/New_York]", { days: 1 }, { disambiguation: "reject" }); // ""
```

Compatibility: to get the earlier value, re-resolve the result's wall-clock time with `setZoned`.

```typescript
setZoned(addZoned("2024-11-03T01:30:00-05:00[America/New_York]", { minutes: 10 }), { hour: 1, minute: 40, second: 0 }, { disambiguation: "earlier", offset: "ignore" });
// "2024-11-03T01:40:00-04:00[America/New_York]"
```

**`diffZoned`, `diffZonedAsDuration` and `intervalLengthZoned` count calendar units on the wall clock.** They converted both values to UTC first, so a 23-hour local day was 0 days. §6.5.6 DifferenceZonedDateTime measures days, weeks, months and years on the wall clock of the shared time zone. For values in two different zones, a calendar unit has no single wall clock to count on, and Temporal throws. These functions now return their sentinel instead. Hours and smaller units are exact time, as before, and work across zones.

```typescript
import { diffZoned, diffZonedAsDuration } from "@northguild/gmt/zoned";

diffZoned("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-10T12:00:00-04:00[America/New_York]", "days"); // 1
diffZonedAsDuration("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-11T12:00:00-04:00[America/New_York]", "days"); // "P2D"
diffZoned("2024-01-01T00:00:00-05:00[America/New_York]", "2024-01-03T00:00:00+01:00[Europe/Paris]", "days"); // null
```

Compatibility: difference the UTC instants to get the UTC-clock value. For `intervalLengthZoned` across two zones, convert both ends to one zone first with `convertZonedToZoned`.

```typescript
diffUtc(convertZonedToUtc("2024-03-09T12:00:00-05:00[America/New_York]"), convertZonedToUtc("2024-03-10T12:00:00-04:00[America/New_York]"), "days"); // 0
diffUtcAsDuration(convertZonedToUtc("2024-03-09T12:00:00-05:00[America/New_York]"), convertZonedToUtc("2024-03-11T12:00:00-04:00[America/New_York]"), "days"); // "P1DT23H"
```

**`intervalOverlappingDaysZoned` and `intervalOverlappingDaysUnix` count the local dates an overlap touches.** They took the calendar difference of the overlap's two endpoint dates and added one. A day a zone deleted was counted, like Samoa's 30 December 2011, and a fall-back that sent the clock back into the previous date could give 0. They now count the distinct local dates the overlap touches.

```typescript
import { intervalOverlappingDaysUnix } from "@northguild/gmt/unix";

intervalOverlappingDaysUnix(1289098830000, 1289100600000, 1289098830000, 1289100600000, { timeZone: "America/Goose_Bay" }); // 2
```

Compatibility: for the earlier number, take the difference of the endpoint dates in the first interval's zone and add one.

```typescript
diffDate(convertUnixToPlainDate(1289098830000, { timeZone: "America/Goose_Bay" }), convertUnixToPlainDate(1289100600000, { timeZone: "America/Goose_Bay" }), "days") + 1; // 0
```
