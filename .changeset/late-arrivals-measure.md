---
"@northguild/gmt": minor
---

Add `scheduleDeviation`, `classifyPunctuality`, `punctualityRate`, `bestAvailable`, `estimateDrift` and `nextDeparture` to the `transport/` namespace (Story TRAN-57).

Every mode publishes a plan and records what happened, and measures the gap the same way. Only the tolerance differs, and the tolerance is the caller's. The other shared problem is that one field often holds four kinds of time — planned, estimated, requested and actual — and an estimate shown as an actual is the standard tracking-dashboard error.

```typescript
import { bestAvailable, classifyPunctuality, estimateDrift, nextDeparture, punctualityRate, scheduleDeviation } from "@northguild/gmt";

scheduleDeviation("2024-06-15T10:00:00Z", "2024-06-15T10:14:00Z"); // "PT14M"
scheduleDeviation("2024-06-15T10:00:00Z", "2024-06-15T09:55:00Z"); // "-PT5M" — five minutes early
scheduleDeviation("2024-11-03T01:30:00-04:00[America/New_York]", "2024-11-03T01:30:00-05:00[America/New_York]");
// "PT1H" — the same wall time, an hour later across the fall-back night

classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:14:59Z", { late: "PT15M" }); // "onTime"
classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T10:15:00Z", { late: "PT15M" }); // "late"
classifyPunctuality("2024-06-15T10:00:00Z", "2024-06-15T09:49:00Z", { late: "PT15M", early: "PT10M" }); // "early"

punctualityRate([
  { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:05:00Z" },
  { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:14:00Z" },
  { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T10:16:00Z" },
  { planned: "2024-06-15T10:00:00Z", actual: "2024-06-15T09:57:00Z" },
], { late: "PT15M" });
// { onTime: 3, total: 4, rate: 0.75 }

bestAvailable([
  { classifier: "ACT", at: "2024-06-15T12:52:00Z", recordedAt: "2024-06-15T12:53:00Z" },
  { classifier: "EST", at: "2024-06-15T13:05:00Z", recordedAt: "2024-06-15T14:00:00Z" },
]);
// { at: "2024-06-15T12:52:00Z", classifier: "ACT" } — an estimate recorded later never replaces an actual

estimateDrift([
  { classifier: "EST", at: "2024-06-20T08:00:00Z", recordedAt: "2024-06-01T00:00:00Z" },
  { classifier: "EST", at: "2024-06-20T12:00:00Z", recordedAt: "2024-06-05T00:00:00Z" },
  { classifier: "EST", at: "2024-06-20T17:00:00Z", recordedAt: "2024-06-10T00:00:00Z" },
], { tolerance: "PT8H" });
// { first: "2024-06-20T08:00:00Z", last: "2024-06-20T17:00:00Z", drift: "PT9H", revisions: 3, exceedsTolerance: true }

const timetable = ["2024-06-15T08:00:00Z", "2024-06-15T09:30:00Z", "2024-06-15T11:00:00Z"];
nextDeparture("2024-06-15T09:00:00Z", timetable, { minimumConnection: "PT45M" }); // "2024-06-15T11:00:00Z"
nextDeparture("2024-06-15T06:05:00+02:00", { headway: "PT20M", from: "2024-06-15T06:00:00+02:00", to: "2024-06-15T09:00:00+02:00" });
// "2024-06-15T06:20:00+02:00"
```

- **A deviation is exact elapsed time.** `scheduleDeviation` returns `actual` minus `planned` with hours as the largest unit: positive when late, negative when early, `PT48H` rather than `P2D`. A delay across a fall-back night is `PT1H`, never the `PT0S` or `PT2H` a wall-clock subtraction gives. Both times are an instant or a zoned string, and the zone they are written in does not matter.
- **"On time" needs a stated tolerance.** GMT has no default. `PunctualityTolerance` is `{ late, early? }` as ISO 8601 durations of exact time: a day is 24 hours, and years, months, weeks or a negative value return `null`. A 15-minute tolerance, a 60/120-minute pair and a day-based one are all the same call with different numbers.
- **Both edges belong to the outside.** Exactly `late` is late, and exactly `-early` is early. Without `early`, every early arrival is on time. `classifyPunctuality` returns `null` on invalid input, as `classifyLocal` does.
- **A rate is a count under one tolerance.** `punctualityRate` reads the tolerance once and judges every pair under it. Only `"onTime"` counts, so with an `early` tolerance an early arrival is not on time. `rate` is not rounded. An empty list, or any invalid pair, returns `null` — never a rate over the rest.
- **The class travels with the value.** `TimestampEvent` records a `classifier` (`PLN`, `EST`, `REQ` or `ACT`, DCSA's vocabulary), the moment `at` and when it was `recordedAt`. `bestAvailable` picks an `ACT` whenever one exists, else `PLN`, else `REQ`, else `EST`, and the newest-recorded within that class. The order is fixed and documented. It returns the class with the value, and echoes `at` exactly as written.
- **Drift needs two estimates.** `estimateDrift` reads only the `EST` records, in recording order, and reports the last minus the first. It returns `null` with fewer than two, since one estimate has no drift. With `tolerance`, `exceedsTolerance` is `true` when the drift in either direction is greater than it; exactly the tolerance is `false`.
- **`nextDeparture` is timetable lookup, not routing.** It returns the first departure at or after `after` plus `minimumConnection` (default `"PT0S"`); one exactly at that threshold is made. A list entry is returned exactly as written, so it can go straight into `scheduleDelivery` as a leg's `departure`. Every moment must carry its offset: a wall time without one returns `""`, because in a repeated fall-back hour it names two departures.
- **A headway window is half-open.** `{ headway, from, to }` has the shape of a GTFS `frequencies.txt` row. Departures are `from` plus whole headways in exact time, up to but never at `to`, and are computed from `from` rather than stepped. The result is written the way `from` was written.
- Also exported: the `TimestampClass`, `TimestampEvent`, `PunctualityTolerance`, `Punctuality`, `PlannedActual`, `OnTimeRate`, `ClassifiedTimestamp`, `EstimateDriftOptions`, `DriftReport`, `Headway` and `NextDepartureOptions` types.
