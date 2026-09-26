---
"@northguild/gmt": minor
---

Add `crossingTime` and `scheduleDelivery` to the `transport/` namespace (Story TRAN-9).

A crossing — a canal transit, a strait passage, a border queue — is logged as two instants and read on the clock of whoever runs it. A multi-leg move — truck, ship, rail — is one departure, a duration per leg and a handling time at each handoff, and the handoffs are where a naive ETA loses an hour. Every leg boundary here is an exact instant; local time is rendered only at the edges.

```typescript
import { crossingTime, scheduleDelivery } from "@northguild/gmt";

crossingTime("2024-03-10T05:00:00Z", "2024-03-10T12:00:00Z", "America/New_York");
// { duration: "PT7H", enter: "2024-03-10T00:00:00-05:00[America/New_York]",
//   exit: "2024-03-10T08:00:00-04:00[America/New_York]" } — seven hours across the spring-forward

const legs = [
  { departure: "2024-06-14T08:00:00", duration: "PT6H", timeZone: "Asia/Shanghai", dwellAfter: "PT12H", mode: "truck" },
  { departure: "2024-06-15T10:00:00+08:00[Asia/Shanghai]", duration: "PT336H", timeZone: "America/Los_Angeles", dwellAfter: "PT48H", mode: "ship" },
  { duration: "PT70H", timeZone: "America/Chicago", mode: "rail" },
];
scheduleDelivery(legs, { startTimeZone: "Asia/Shanghai" });
// { eta: "2024-07-03T19:00:00-05:00[America/Chicago]", legTimes: [
//   { arrival: "2024-06-14T06:00:00Z", localArrival: "2024-06-14T14:00:00+08:00[Asia/Shanghai]", dwellAfter: "PT12H", mode: "truck" },
//   { arrival: "2024-06-29T02:00:00Z", localArrival: "2024-06-28T19:00:00-07:00[America/Los_Angeles]", dwellAfter: "PT48H", mode: "ship" },
//   { arrival: "2024-07-04T00:00:00Z", localArrival: "2024-07-03T19:00:00-05:00[America/Chicago]", dwellAfter: "PT0S", mode: "rail" } ] }

scheduleDelivery([legs[0], { ...legs[1], departure: "2024-06-14T20:00:00+08:00[Asia/Shanghai]" }], { startTimeZone: "Asia/Shanghai" });
// null — the sailing leaves inside the truck leg's 12-hour dwell: a missed connection
```

- **`crossingTime` measures, it does not count days.** It returns the exact elapsed duration, hours as the largest unit, and the entry and exit rendered in `targetZone`, an IANA identifier or a fixed offset. `targetZone` is always the rendering zone; a bracketed zone on the input is ignored. A crossing that needs a day count is a dwell — use `dwellTime`. An exit before the entry returns `null`; a zero-length crossing is `PT0S`.
- **`dwellAfter` is the minimum connect time.** A leg leaves at its own `departure`, or, when it has none, at the previous arrival plus the previous leg's `dwellAfter`. A scheduled departure earlier than that — inside the dwell or before the arrival — is a missed connection and returns `null`; equal passes, so a zero-slack connection is feasible. `dwellAfter` is echoed as written, `"PT0S"` when omitted. The last leg's dwell is validated and echoed but never added to an instant, so it cannot turn a representable ETA into `null`.
- **Departures must be exact.** An instant (`Z` or an offset) or a zoned string, whose bracketed zone must be real and agree with its offset. The one exception is the first leg: schedules are published as local wall times, so a zoneless first departure is read in `startTimeZone`. Zoneless without the option, or on any later leg, returns `null`.
- **Wall times resolve as `"compatible"`.** An ambiguous wall time — a fall-back hour the clock ran through twice — resolves to the earlier instant; a skipped one resolves to the later instant. Write the offset to pick the other pass of a repeated hour.
- **Durations follow `transitTime`.** Time units are elapsed time, a day is 24 hours, and years, months and weeks return `null`. A negative leg returns `null`: a leg cannot arrive before it departs. A single-leg schedule is exactly `transitTime` composed with `etaAtZone`.
- **Tags are opaque.** `mode`, `origin` and `destination` are echoed onto each `LegTime`, and absent when not supplied, so a caller can join results to its own records. GMT never resolves a code to a zone; `timeZone` is the caller's fact. An empty legs array returns `{ eta: "", legTimes: [] }`.
- Also exported: the `Crossing`, `Leg`, `LegTime`, `ScheduleDeliveryOptions` and `DeliverySchedule` types.
