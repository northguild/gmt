---
"@northguild/gmt": minor
---

Add the `transport/` namespace: `transitTime`, `etaAtZone` and `dwellTime` (Story TRAN-8).

Every transport mode shares three operations — add a leg's duration to a departure, show the arrival where it lands, and measure how long something sat somewhere — and every mode gets the same two things wrong: a leg across a DST transition is a fixed number of *elapsed* hours, and dwell is charged in *local calendar days*, not hours.

```typescript
import { dwellTime, etaAtZone, transitTime } from "@northguild/gmt";

transitTime("2024-03-09T23:00:00-05:00[America/New_York]", "PT4H");
// "2024-03-10T04:00:00-04:00[America/New_York]" — four elapsed hours across the spring-forward

etaAtZone("2024-06-15T12:30:00Z", "Asia/Tokyo");
// "2024-06-15T21:30:00+09:00[Asia/Tokyo]"

dwellTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", "Europe/London");
// { duration: "PT2H30M", enter: "2024-06-15T23:30:00+01:00[Europe/London]",
//   exit: "2024-06-16T02:00:00+01:00[Europe/London]", calendarDays: 2 }
dwellTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", "Europe/Amsterdam");
// { …, calendarDays: 1 } — the same two instants, one fewer day: the zone decides
```

- **`transitTime` adds exact time.** Hours, minutes and seconds are elapsed time and a `D` component is 24 hours exactly; the wall clock at arrival reflects any DST shift in between. Years, months and weeks return `""` — no leg takes "a month" without a reference point. The departure's zone is preserved: a bracketed IANA zone stays that zone, `Z` stays `Z`, an offset stays an offset. A bracketed zone that does not exist or contradicts its offset is rejected, not silently reinterpreted.
- **`etaAtZone` renders a moment in a zone**, so no disambiguation arises: on a fall-back night two arrivals an hour apart print the same wall time with different offsets, and the offset in the result tells them apart. The zone is the caller's fact — GMT does not resolve a port, airport or station code to a timezone.
- **`dwellTime.calendarDays` is the library's one "local days crossed" count.** It is the number of distinct local dates the half-open interval `[entry, exit)` touches: same date is `1`, across one local midnight is `2`, an exit exactly at local midnight does not touch the new day. It comes from the zone's real day boundaries (`floorToZone`), so a 23- or 25-hour local day is one day. Free time and demurrage, laytime and hospital length of stay will all count from here rather than each deciding what a midnight is.
- **A day count needs a place.** `dwellTime` takes the zone from `targetZone`, or from the entry's bracketed IANA zone. Bare instants (`Z` or an offset) with no `targetZone` return `null`: an offset is not a zone, and a day count in an unstated locality would be a guess.
- Also exported: the `Dwell` result type. Subpaths `@northguild/gmt/transport`, `…/transport/calculate` and `…/transport/convert` join the package exports.
