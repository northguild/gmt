---
"@northguild/gmt": minor
---

Add `bolTimestamp` and `multimodalETA` to the `intermodal/` namespace, and the `@northguild/gmt/intermodal/format` subpath (Story INT-14).

A bill of lading carries dates, not timestamps: the date it was issued, the date the cargo was received, and the date it was loaded on board, each on the local calendar of the place it happened. A system that records the loading as an instant has to turn it back into that date, and the UTC date is wrong for part of every day. An end-to-end ETA has the opposite problem: it is one instant, but the time behind it is spent two ways, moving and waiting at handoffs, and the two are forecast differently.

```typescript
import { bolTimestamp, multimodalETA } from "@northguild/gmt";

// Loaded at 21:00 in New York, which is 01:00Z on the 16th. The B/L is dated the 15th.
bolTimestamp("2024-06-16T01:00:00Z", "shippedOnBoard", { timeZone: "America/New_York" }); // "2024-06-15"

// Loaded at 07:00 in Shanghai, which is 23:00Z on the 14th. The UTC date is a day early.
bolTimestamp("2024-06-14T23:00:00Z", "shippedOnBoard", { timeZone: "Asia/Shanghai" }); // "2024-06-15"

bolTimestamp("2024-06-16T01:00:00Z", "shippedOnBoard"); // "" (every B/L date is local: the zone is required)

// Truck, ship and rail, Shanghai to Chicago.
const legs = [
  { departure: "2024-06-10T08:00:00+08:00[Asia/Shanghai]", duration: "PT6H",
    timeZone: "Asia/Shanghai", dwellAfter: "P2D", mode: "truck" },
  { duration: "P14DT6H", timeZone: "America/Los_Angeles", dwellAfter: "PT36H", mode: "ship" },
  { duration: "PT52H", timeZone: "America/Chicago", mode: "rail" },
];
multimodalETA(legs);
// { eta: "2024-06-29T23:00:00-05:00[America/Chicago]", totalLegs: 3,
//   totalTransit: "PT400H", totalDwell: "PT84H" } (484 hours door to door)

// The ship sails at 10:00 Shanghai time on the 13th, 20 hours after the dwell ends. The wait is dwell too.
multimodalETA([legs[0], { ...legs[1], departure: "2024-06-13T10:00:00+08:00[Asia/Shanghai]" }, legs[2]]);
// { eta: "2024-06-30T19:00:00-05:00[America/Chicago]", totalLegs: 3,
//   totalTransit: "PT400H", totalDwell: "PT104H" }
```

- **A B/L date is a local date.** The DCSA Bill of Lading 3.0 standard types `issueDate`, `receivedForShipmentDate` and `shippedOnBoardDate` as dates with no time and no offset. `bolTimestamp` returns `YYYY-MM-DD`, the date on the local clock in `timeZone` at the instant given.
- **The zone is required, and it is the place's.** There is no UTC default and no system zone. Date an `issue` in the place of issue's zone, and `received`, `onBoard` and `shippedOnBoard` in the zone of the terminal at the port of loading, where DCSA dates receipt (the last container in the terminal, cleared for the intended vessel) and shipment (the last container loaded).
- **`event` names the date; it does not change it.** `issue`, `received`, `onBoard` and `shippedOnBoard` are all local dates, so they render the same way. Anything else returns `""`.
- **Only the instant is read.** A bracketed zone in the value is not the zone the date is read in, and a zoneless wall time or a bare date returns `""`.
- **`multimodalETA` schedules with `scheduleDelivery`.** The `Leg` type, the missed-connection rule, wall-time departures and `startTimeZone` are that function's, and `eta` is its `eta`.
- **Transit and dwell are reported apart, and add up to the elapsed time.** `totalTransit` is every leg's `duration` added up, as exact time. `totalDwell` is the time actually spent at the handoffs, so a wait for a scheduled departure counts; when every leg chains from the one before, it is the sum of the `dwellAfter` values. The last leg's `dwellAfter` is not dwell, because no handoff follows it. Both totals have hours as the largest unit.
- **Dwell is never estimated.** It is the caller's `dwellAfter` and schedule.
- Also exported: the `BillOfLadingEvent`, `BolTimestampOptions` and `MultimodalJourney` types.
