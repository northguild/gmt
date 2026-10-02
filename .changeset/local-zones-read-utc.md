---
"@northguild/gmt": minor
---

Accept `timeZone: "local"` for the system time zone in the `utc` readers and converters, as the `utc` formatters and every `unix` function already do.

Before, `"local"` returned the empty result (`""` or `null`) from these functions, while `formatUtc`, `formatCalendarUtc`, `formatRelativeUtc` and the matching `unix` functions read it as the system zone. Every `utc` function that takes a `timeZone` option now reads it the same way: omitted is UTC, `"local"` is the system time zone, and an IANA name or a UTC offset is that zone.

This applies to `parseDateFromUtc`, `parseTimeFromUtc`, `parseYearFromUtc`, `parseMonthFromUtc`, `parseWeekFromUtc`, `parseDayFromUtc`, `parseDayOfWeekFromUtc`, `parseHourFromUtc`, `parseMinuteFromUtc`, `parseSecondFromUtc`, `parseMillisecondFromUtc`, `parseMicrosecondFromUtc`, `parseNanosecondFromUtc`, `parseUnitFromUtc`, `convertUtcToPlainDate`, `convertUtcToPlainTime` and `convertUtcToPlainDateTime`.

```typescript
import { convertUtcToPlainDate, parseHourFromUtc } from "@northguild/gmt";

// On a machine whose time zone is Asia/Tokyo (UTC+9)
parseHourFromUtc("2024-01-30T20:30:45Z"); // "20", unchanged: an omitted zone is UTC
parseHourFromUtc("2024-01-30T20:30:45Z", { timeZone: "Asia/Tokyo" }); // "05", unchanged
parseHourFromUtc("2024-01-30T20:30:45Z", { timeZone: "local" }); // "05" — was ""
convertUtcToPlainDate("2024-01-30T20:30:45Z", { timeZone: "local" }); // "2024-01-31" — was ""
```

Unchanged: an omitted `timeZone` still reads UTC, never the system zone, and an unknown zone still returns the empty result. `convertUtcToZoned` takes its zone as a required argument and still accepts only an IANA name or a UTC offset, as `convertUnixToZoned` does.
