---
"@northguild/gmt": patch
---

Fix zone-aware boundaries, counts and splits that went wrong around DST transitions and month ends.

Every fix follows TC39 Temporal. A boundary is a real instant in the zone, never a wall-clock time re-resolved after truncation. Repeated calendar steps are measured from the original anchor.

- **`startOfZoned`, `endOfZoned`, `startOfUnix`, `endOfUnix`, `getLocaleZonedStartOfWeek`, `getLocaleZonedEndOfWeek`, `startOfQuarterForZoned`, `startOfQuarterForUnix`, `endOfQuarterForZoned`, `endOfQuarterForUnix`** now return the real start and end of the unit that contains the input when no `disambiguation` or `offset` is passed. A start is never after the input and an end never before it. Before, `startOfZoned` could place Pacific/Chatham's hour 15 minutes *after* its input, and `endOfZoned` could end New York's repeated 1 a.m. hour before the input. Passing `disambiguation` or `offset` still opts into Temporal's wall-clock `.with()` resolution, unchanged. `areZonedEqualBy` and `areUnixEqualBy` inherit the fix.
- **`intervalCountZoned`, `intervalCountUnix`, `intervalCountUtc`** count the buckets `bucketRange` would return. A 20-minute Chatham range straddling 04:00 now counts 2 hours, not 1, and a span over Samoa's deleted 30 December 2011 counts 2 days, not 3. A zoned or Unix span crossing more than 10,000 zone transitions returns `null` rather than an estimate.
- **`startOfQuarterForZoned`, `startOfQuarterForUnix`, `startOfQuarterForUtc`** reset milliseconds, microseconds and nanoseconds. `2024-05-15T12:34:56.789Z` now starts its quarter at `2024-04-01T00:00:00Z`, not `…00:00:00.789Z`.
- **`getHoursInZonedDay`** returns Temporal's `hoursInDay`, so a day whose midnight is skipped (America/Santiago, 8 September 2024) is 23 hours, not 24. **`mapZonedHoursInDay`** stops at the next local day.
- **`splitIntervalByUnitDate`, `splitIntervalByUnitDateTime`, `splitIntervalByUnitZoned`, `splitIntervalByUnitUnix`, `splitIntervalByUnitUtc`** no longer drift at month ends. Splitting from 31 January by month now gives 29 February, 31 March, 30 April, not 29 February, 29 March, 29 April. A yearly split from 29 February returns to 29 February in leap years.
- **`getDstTransitions`** reports a transition that falls exactly at local midnight on 1 January (Asia/Singapore, 1982), and returns `[]` rather than a truncated list if its scan limit is ever exhausted.
- **`floorToZone`** and **`bucketRange`** return `""` and `[]` rather than a plausible wrong boundary if the zone walker ever runs out of transitions.

`getFiscalPeriod`, `roundZoned`, `roundUnix`, `parseRfc2822` and `parseHttp` behave as before. Their documentation now states how a 29 February fiscal anchor clamps, how `round` behaves in Chatham, and that impossible dates such as 31 February are rejected.
