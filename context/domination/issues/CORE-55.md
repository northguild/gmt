# CORE-55 — Core: Operating hours and recurring windows

**Scope:** Weekly opening hours with holidays and overrides, the concrete instants they produce, and the arithmetic every service-level clock runs on: how much open time elapsed, and when a deadline measured in open time falls.

## Gap

CORE-7 answers "is this a business day". Nothing in the library answers "is this place open right now", "how many working hours passed between these two instants", or "if the SLA is eight working hours, when is it due" — and those are the questions a terminal gate, a support desk, a trading venue, a customs office, a pharmacy and a crew-rest rule all ask. Each realm was about to answer it privately:

- INT-12 working-day free time suspends the clock outside gate hours.
- FIN-40 session templates are opening hours with named phases.
- AV-27's WOCL (02:00–05:59 local) and AV-28's curfews (23:00–06:00 local) are recurring windows that wrap midnight.
- MAR-19 office hours decide when a Notice of Readiness can be tendered.
- ROAD truck-ban regimes (Sunday bans, holiday bans) are recurring closed windows.
- HLTH turnaround targets and IOT maintenance windows are open-time SLAs.

One implementation of "weekday × local time window, with holidays and one-off overrides, resolved to instants in a zone" is what stops seven realms disagreeing about a midnight wrap or a DST-night window.

## Scope

- `packages/gmt/src/types/operating-schedule.ts`:
  - `LocalWindow` is `{ from: string, to: string }` — local wall times; `to` at or before `from` means the window wraps past midnight.
  - `OperatingSchedule` is `{ timeZone: string, weekly: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, LocalWindow[]>>, holidays?: string[], overrides?: { date: string, windows: LocalWindow[] }[] }` — ISO weekdays; a holiday date is closed unless an override says otherwise; an override replaces that date's windows entirely.
- `packages/gmt/src/calendar/hours/recurringWindows.ts`:
  - `recurringWindows(weekly: OperatingSchedule['weekly'], range: Interval, timeZone: string, options?: { disambiguation?: Disambiguation }): Interval[]` — The concrete instants of a weekly pattern inside a range, merged where windows touch. No holidays; the primitive under everything else.
- `packages/gmt/src/calendar/hours/operatingIntervals.ts`:
  - `operatingIntervals(schedule: OperatingSchedule, range: Interval, options?): Interval[]` — `recurringWindows` with holidays removed and overrides applied.
- `packages/gmt/src/calendar/hours/operatingState.ts`:
  - `isOpenAt(isoString: string, schedule: OperatingSchedule): boolean`
  - `nextOpenAt(isoString: string, schedule: OperatingSchedule, options?: { within?: string }): string` — The next opening instant at or after the input; `''` when none within the search horizon.
  - `nextCloseAt(isoString: string, schedule: OperatingSchedule, options?): string`
- `packages/gmt/src/calendar/hours/operatingTime.ts`:
  - `operatingTimeBetween(start: string, end: string, schedule: OperatingSchedule): string` — Exact open time elapsed, as an ISO duration.
  - `addOperatingTime(start: string, duration: string, schedule: OperatingSchedule, options?: { within?: string }): string` — The instant at which `duration` of open time has elapsed; the service-level deadline.

## Design notes

- **Windows are local wall times, so every edge inherits CORE-4.** A window edge that falls in a nonexistent local hour on a spring-forward night, or in a repeated hour on a fall-back night, is resolved with `resolveLocal` under the `disambiguation` option, whose default (`'compatible'`) and behaviour are stated in the JSDoc using the [LOCAL_TIME_RESOLUTION.md](../../reference/LOCAL_TIME_RESOLUTION.md) vocabulary. A 23:00–06:00 window is 23 or 25 hours long on those nights, and the function says which.
- **Midnight wrap is explicit in the type.** `{ from: '23:00', to: '06:00' }` on weekday 5 is Friday night into Saturday morning; the window is attributed to the weekday it starts on. Callers building curfews, night bans and WOCL windows get one rule instead of five.
- **Holidays and overrides are dates in the schedule's zone**, consistent with CORE-7's `BusinessCalendar`, and a `BusinessCalendar` can be passed as `holidays` directly.
- **`operatingTimeBetween` and `addOperatingTime` are interval algebra**, not loops over minutes: intersect the open intervals with the range and sum (CORE-6), or walk open intervals until the duration is consumed. A deadline that would fall past `within` returns `''` rather than searching forever; the horizon default is stated.
- **This is not RFC 5545.** Weekly patterns with dated exceptions cover every consumer in the epic; monthly and yearly recurrence stay parked (see painpoints). The type is deliberately too small to become a recurrence engine.
- FIN-40's `MarketCalendar.sessions` are `LocalWindow`s with a phase tag and are resolved through `recurringWindows`; the two types share the edge semantics by construction.

## What gmt provides (do not re-implement)

- `resolveLocal` / `classifyLocal` from CORE-4 — window-edge resolution and the disambiguation vocabulary
- `bucketRange` / `floorToZone` from CORE-5 — walking local days in the schedule's zone
- `intersectIntervals` / `subtractIntervals` / `mergeIntervals` / `sumIntervals` from CORE-6 — the algebra under every function here
- `BusinessCalendar` / `isBusinessDay` from CORE-7 — holiday dates

## Verification

- A Monday–Friday 09:00–17:00 schedule over one week yields five eight-hour intervals; `operatingTimeBetween` over that week is `PT40H`
- `{ from: '23:00', to: '06:00' }` yields a seven-hour interval attributed to the start weekday, and `isOpenAt` at 01:00 the next morning is `true`
- A window crossing a fall-back night is 25 hours long under the documented default and the JSDoc states the policy; on the spring-forward night a `02:30` edge resolves per `disambiguation` and never returns the sentinel silently
- A holiday date yields no interval; an override for that date yields exactly the override's windows
- `nextOpenAt` on Saturday 12:00 for a weekday schedule returns Monday 09:00 local as an instant
- `addOperatingTime(Friday 16:00, 'PT2H')` on the weekday schedule returns Monday 10:00; with `within: 'P1D'` it returns `''`
- `operatingTimeBetween` equals the sum of `intersectIntervals(operatingIntervals(...), range)` lengths, asserted
- `battleTestTimeZones` coverage plus probe-zone transition rows (see `context/coding-standards.md` § Calendar & zone semantics)
- Invalid weekday key, malformed window or invalid zone returns the sentinel
- `pnpm run validate` stays green
