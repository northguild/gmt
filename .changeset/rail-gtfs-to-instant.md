---
"@northguild/gmt": minor
---

New `gtfsToInstant(serviceDate, gtfsTime, timeZone)` in `@northguild/gmt/rail/convert` and `@northguild/gmt/rail`: turn a GTFS stop time into the instant it happens, as a UTC string ending in `"Z"`.

A GTFS time is counted from noon minus 12 hours of the service day, not from midnight. On most days that is midnight, but on a day when the clocks change it is not. `gtfsToInstant` finds noon on the service date in the agency's time zone, goes back 12 hours, and adds the GTFS time as exact seconds. The zone is the feed's `agency_timezone`, even for a stop that has its own `stop_timezone`.

```typescript
import { gtfsToInstant } from "@northguild/gmt/rail/convert";

gtfsToInstant("20240130", "25:35:00", "America/Los_Angeles"); // "2024-01-31T09:35:00Z"
gtfsToInstant("2024-01-30", "25:35:00", "America/Los_Angeles"); // "2024-01-31T09:35:00Z"
gtfsToInstant("20240331", "00:00:00", "Europe/Berlin"); // "2024-03-30T22:00:00Z" (23:00 local)
```

- **The service date** is `YYYYMMDD` (the GTFS form) or `YYYY-MM-DD`. A date that does not exist, such as `20240230`, returns `""`.
- **The GTFS time** is read as `parseGtfsTime` reads it, so `25:35:00` and `110:29:00` are fine and `25:60:00` returns `""`.
- **A skipped or repeated noon returns `""`.** If the zone had no noon on that date, or had it twice, the anchor is unclear and the result is empty, not a guess.
- **Invalid input returns `""`.** This includes a time zone that does not exist and a value that is not a string.
