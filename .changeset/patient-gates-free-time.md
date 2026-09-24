---
"@northguild/gmt": minor
---

Add the `intermodal/` namespace: `freeTimeExpiry`, `chargeableDays` and `demurrageClock` (Story INT-12).

Free time is the money calculation in container logistics, and none of its terms is a fact about the port or fixed by a world standard. How many days are free, whether the day of discharge is free day one, how free days and charged days are counted, and which clock a charge runs on are set by the carrier's tariff and the service contract. DCSA defines what demurrage, detention and storage are, but not how their days are counted. So every term is a parameter, no counting term has a default, and what comes back is the free-time window and the specific dates charged.

```typescript
import { chargeableDays, demurrageClock, freeTimeExpiry } from "@northguild/gmt";

const tariff = { basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" };

// A Friday afternoon discharge in New York with three free calendar days.
freeTimeExpiry("2024-06-14T19:00:00Z", 3, tariff);
// { freeTimeStart: "2024-06-14", lastFreeDay: "2024-06-16", expiresAt: "2024-06-17T04:00:00Z" }
freeTimeExpiry("2024-06-14T19:00:00Z", 3, { ...tariff, firstDay: "nextDay" });
// { freeTimeStart: "2024-06-15", lastFreeDay: "2024-06-17", expiresAt: "2024-06-18T04:00:00Z" }
// — the same tariff read the other way: one more day

// Out exactly as free time ends, and one second later.
chargeableDays("2024-06-14T19:00:00Z", "2024-06-17T04:00:00Z", 3, tariff);
// { freeDaysUsed: 3, chargeableDays: 0, expiresAt: "2024-06-17T04:00:00Z",
//   chargedDates: [], byTier: [{ from: 1, to: null, days: 0 }] }
chargeableDays("2024-06-14T19:00:00Z", "2024-06-17T04:00:01Z", 3, tariff);
// { freeDaysUsed: 3, chargeableDays: 1, expiresAt: "2024-06-17T04:00:00Z",
//   chargedDates: ["2024-06-17"], byTier: [{ from: 1, to: null, days: 1 }] }

// Which two events a charge runs between, per leg.
demurrageClock(
  [
    { type: "discharged", at: "2024-06-14T19:00:00Z" },
    { type: "gatedOut", at: "2024-06-20T14:30:00Z" },
    { type: "emptyReturned", at: "2024-06-27T09:00:00Z" },
  ],
  "detention",
  { direction: "import" },
);
// { start: "2024-06-20T14:30:00Z", end: "2024-06-27T09:00:00Z" } — gate-out to empty return
```

- **Days are the terminal's local days.** `clockStart` and `clockEnd` are instants; their local dates in `options.timeZone` are what is counted, over the zone's real day boundaries, the same ones `dwellTime` and `floorToZone` find. A 23- or 25-hour day is one day, a date the zone deleted is never a free or charged day, and a date the clock falls back into counts once. On the calendar basis with `firstDay: "eventDay"`, `freeDaysUsed + chargeableDays` is exactly `dwellTime(...).calendarDays` for the same dwell, except that a fall-back re-entering the day before the event day (Goose Bay, 7 November 2010) is a date `dwellTime` counts and a tariff never does.
- **`firstDay` has no default.** `"eventDay"` makes the event day free day one; `"nextDay"` starts free time the following counted day. The two differ by a full day of charges, so omitting it returns `null`.
- **`basis` counts free days; `chargeBasis` counts charged days.** `"calendar"` counts every local day; `"working"` counts only the working days of `options.calendar`, a `BusinessCalendar`, and returns `null` without one. Outside the US both are mostly calendar days; where free time is in working days (the usual US shape), the days after it are mostly charged as calendar days, and California law and some tariffs charge working days only. Neither term has a default, because each is worth days of charges.
- **Expiry is half-open.** `expiresAt` is the first instant of the local day after `lastFreeDay`, as a UTC instant. A gate-out at exactly `expiresAt` is not a chargeable day; one nanosecond later is.
- **`chargedDates` makes the count auditable.** It is the list a carrier's day-numbered tariff grid is applied to; on US trades the invoice must also print it (46 CFR 541.6, the US invoice rule).
- **Tiers are day bands, not rates.** `tiers: [5, 10]` names days 1–5, 6–10 and 11 onward; `byTier` says how many charged days fell in each band, empty bands included, so a rate table applies by index. GMT computes days, never money.
- **`freeDays: 0`** is a tariff with no free time: `chargeableDays` charges every counted day from day one, and `freeTimeExpiry` returns `null` because there is no last free day to name.
- **`demurrageClock` selects the pair for a leg.** Import demurrage and storage run from `startEvent` (`"discharged"` by default, or `"available"`) to `gatedOut`, detention from `gatedOut` to `emptyReturned`, and the combined clock from `startEvent` to `emptyReturned`. Export demurrage and storage run from `gatedIn` to `loaded`, detention from `emptyReleased` to `gatedIn`, and the combined clock from `emptyReleased` to `loaded`. `direction` has no default. The event names follow DCSA's Track & Trace equipment events. A required event that is missing or present twice, or an end before its start, returns `null`; the result is an `Interval` in the caller's own strings.
- Also exported: the `FreeTime`, `FreeTimeCharges`, `FreeTimeChargeOptions`, `TierBand`, `ClockEvent`, `ClockEventType`, `ClockScope`, `ClockDirection`, `ClockStartEvent` and `ClockOptions` result and argument types, and `FreeTimeOptions`, `FreeTimeBasis` and `FreeTimeFirstDay` under `/types`. Subpaths `@northguild/gmt/intermodal` and `…/intermodal/calculate` join the package exports.
