---
"@northguild/gmt": minor
---

Add the `intermodal/` namespace: `freeTimeExpiry`, `chargeableDays` and `demurrageClock` (Story INT-12).

Free time is the money calculation in container logistics, and none of its terms is a fact about the port. How many days are free, whether the day of discharge is free day one, whether weekends count, and which clock a charge runs on are set by the carrier's tariff and the service contract. So every term is a parameter, none has a default, and what comes back is what 46 CFR 541.6 requires a demurrage or detention invoice to state: the free time allowed, the dates it started and ended, and the specific dates charged.

```typescript
import { chargeableDays, demurrageClock, freeTimeExpiry } from "@northguild/gmt";

// A Friday afternoon discharge in New York with three free calendar days.
freeTimeExpiry("2024-06-14T19:00:00Z", 3, { basis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" });
// { freeTimeStart: "2024-06-14", lastFreeDay: "2024-06-16", expiresAt: "2024-06-17T04:00:00Z" }
freeTimeExpiry("2024-06-14T19:00:00Z", 3, { basis: "calendar", timeZone: "America/New_York", firstDay: "nextDay" });
// { freeTimeStart: "2024-06-15", lastFreeDay: "2024-06-17", expiresAt: "2024-06-18T04:00:00Z" }
// — the same tariff read the other way: one more day

// Out exactly as free time ends, and one second later.
chargeableDays("2024-06-14T19:00:00Z", "2024-06-17T04:00:00Z", 3, { basis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" });
// { freeDaysUsed: 3, chargeableDays: 0, expiresAt: "2024-06-17T04:00:00Z",
//   chargedDates: [], byTier: [{ from: 1, to: null, days: 0 }] }
chargeableDays("2024-06-14T19:00:00Z", "2024-06-17T04:00:01Z", 3, { basis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" });
// { freeDaysUsed: 3, chargeableDays: 1, expiresAt: "2024-06-17T04:00:00Z",
//   chargedDates: ["2024-06-17"], byTier: [{ from: 1, to: null, days: 1 }] }

// Which two events a charge runs between.
demurrageClock(
  [
    { type: "discharged", at: "2024-06-14T19:00:00Z" },
    { type: "gatedOut", at: "2024-06-20T14:30:00Z" },
    { type: "emptyReturned", at: "2024-06-27T09:00:00Z" },
  ],
  "detention",
);
// { start: "2024-06-20T14:30:00Z", end: "2024-06-27T09:00:00Z" } — gate-out to empty return
```

- **Days are the terminal's local days.** `clockStart` and `clockEnd` are instants; their local dates in `options.timeZone` are what is counted, over the zone's real day boundaries, the same ones `dwellTime` and `floorToZone` find. A 23- or 25-hour day is one day, a date the zone deleted is never a free or charged day, and a date the clock falls back into counts once. On the calendar basis with `firstDay: "eventDay"`, `freeDaysUsed + chargeableDays` is exactly `dwellTime(...).calendarDays` for the same dwell.
- **`firstDay` has no default.** `"eventDay"` makes the event day free day one; `"nextDay"` starts free time the following counted day. The two differ by a full day of charges, so omitting it returns `null`.
- **`basis` decides which days count.** `"calendar"` counts every local day, so a weekend burns two free days. `"working"` counts only the working days of `options.calendar`, a `BusinessCalendar`, and suspends the clock on weekends and holidays after expiry too; it returns `null` without a calendar rather than assume a weekend.
- **Expiry is half-open.** `expiresAt` is the first instant of the local day after `lastFreeDay`, as a UTC instant. A gate-out at exactly `expiresAt` is not a chargeable day; one nanosecond later is.
- **`chargedDates` is the invoice's list.** 46 CFR 541.6 requires "the specific date(s) for which demurrage and/or detention were charged"; returning them makes the count auditable instead of asserted.
- **Tiers are day bands, not rates.** `tiers: [5, 10]` names days 1–5, 6–10 and 11 onward; `byTier` says how many charged days fell in each band, empty bands included, so a rate table applies by index. GMT computes days, never money.
- **`freeDays: 0`** is a tariff with no free time: `chargeableDays` charges every counted day from day one, and `freeTimeExpiry` returns `null` because there is no last free day to name.
- **`demurrageClock` selects the pair.** Demurrage and storage run from `startEvent` (`"discharged"` by default, or `"available"` where the tariff starts at the availability date) to `gatedOut`; detention runs from `gatedOut` to `emptyReturned`. A required event that is missing or present twice, or an end before its start, returns `null`. The result is an `Interval` in the caller's own strings.
- Also exported: the `FreeTime`, `FreeTimeCharges`, `TierBand`, `ClockEvent`, `ClockEventType`, `ClockScope` and `ClockStartEvent` result and argument types, and `FreeTimeOptions`, `FreeTimeBasis` and `FreeTimeFirstDay` under `/types`. Subpaths `@northguild/gmt/intermodal` and `…/intermodal/calculate` join the package exports.
