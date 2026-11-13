---
"@northguild/gmt": minor
---

New `rail` area: read, write and check the times in a GTFS transit feed. They are in `@northguild/gmt/rail`, in `@northguild/gmt/rail/parse`, in `@northguild/gmt/rail/format` and in `@northguild/gmt/rail/validate`.

A GTFS time, such as the `arrival_time` of a stop, is not a clock reading. A trip that runs past midnight is written with an hour above 23: `25:35:00` is 1:35 on the day after the service day, and it still belongs to that service day. A parser that rejects it loses the stop. One that turns it into `01:35:00` puts every trip after midnight on the wrong date.

- `parseGtfsTime(value)` reads a GTFS time and returns a `GtfsTime`, or `null`.
- `formatGtfsTime(value)` writes a `GtfsTime` back as a GTFS time, or `""`.
- `isValidGtfsTime(value)` is `true` exactly when `parseGtfsTime` would return a value.
- `GtfsTime` is `{ seconds: number; dayOverflow: number }`: the time of day in seconds, and the whole days past the service day.

```typescript
import { formatGtfsTime, parseGtfsTime } from "@northguild/gmt/rail";

parseGtfsTime("25:35:00"); // { seconds: 5700, dayOverflow: 1 }
parseGtfsTime("8:05:00"); // { seconds: 29100, dayOverflow: 0 }
parseGtfsTime("110:29:00"); // { seconds: 52140, dayOverflow: 4 }
formatGtfsTime({ seconds: 5700, dayOverflow: 1 }); // "25:35:00"
parseGtfsTime("25:60:00"); // null
```

- **The days past the service day are kept.** `25:35:00` gives `dayOverflow: 1`, and writing it back gives `25:35:00`, never `01:35:00`.
- **Hours run from 0 to 999.** GTFS sets no upper limit, and real feeds go well past 48 hours. VIA Rail Canada writes `110:29:00` for a train from Vancouver to Toronto. You can write `H:MM:SS`, `HH:MM:SS` or `HHH:MM:SS`; `formatGtfsTime` writes at least two hour digits.
- **A GTFS time is not an instant.** It counts from noon minus 12 hours of the service day, so it matches the wall clock only on a day with no clock change. These functions name no date and read no time zone.
- **Nothing is trimmed.** A space, a tab, a line break or a byte order mark returns the empty result. Remove them when you read the CSV file.
- **A value that cannot be read returns the empty result.** `parseGtfsTime` returns `null`, `formatGtfsTime` returns `""` and `isValidGtfsTime` returns `false`. This includes minutes or seconds above 59, a fraction, a sign and a value that is not a string.
