# CORE-55 — Core: Operating hours and recurring windows

**Scope:** Weekly opening hours with holidays and overrides, the concrete instants they produce, and the arithmetic every service-level clock runs on: how much open time elapsed, and when a deadline measured in open time falls.

## Gap

CORE-7 answers "is this a business day". Nothing in the library answers "is this place open right now", "how many working hours passed between these two instants", or "if the SLA is eight working hours, when is it due" — and those are the questions a terminal gate, a support desk, a trading venue, a customs office, a pharmacy and a crew-rest rule all ask. Each realm was about to answer it privately:

- INT-12 working-day free time suspends the clock outside gate hours.
- FIN-40 session templates are opening hours with named phases.
- AV-27's circadian windows and AV-28's curfews (a 23:00–06:00 example) are recurring windows that wrap midnight.
- MAR-19 office hours decide when a Notice of Readiness can be tendered.
- Truck-ban regimes (Sunday bans, holiday bans) are recurring closed windows.
- HLTH turnaround targets and IOT maintenance windows are open-time SLAs.

One implementation of "weekday × local time window, with holidays and one-off overrides, resolved to instants in a zone" is what stops seven realms disagreeing about a midnight wrap or a DST-night window.

## Scope

- `packages/gmt/src/types/operating-schedule.ts`:
  - `LocalWindow` is `{ from: string, to: string }` — local wall times; `to` at or before `from` means the window wraps past midnight.
  - `OperatingSchedule` is `{ timeZone: string, weekly: Partial<Record<IsoWeekday, LocalWindow[]>>, holidays?: string[] | BusinessCalendar, overrides?: OperatingOverride[] }` — ISO weekdays; a holiday date is closed unless an override says otherwise; an override replaces that date's windows entirely. `IsoWeekday` is `1 | 2 | 3 | 4 | 5 | 6 | 7`; `OperatingOverride` is `{ date: string, windows: LocalWindow[] }`.
- `packages/gmt/src/calendar/hours/recurringWindows.ts`:
  - `recurringWindows(weekly: OperatingSchedule['weekly'], range: Interval, timeZone: string, options?: { disambiguation?: Disambiguation }): Interval[]` — The concrete instants of a weekly pattern inside a range, merged where windows touch. No holidays; the primitive under everything else.
- `packages/gmt/src/calendar/hours/operatingIntervals.ts`:
  - `operatingIntervals(schedule: OperatingSchedule, range: Interval, options?): Interval[]` — `recurringWindows` with holidays removed and overrides applied.
- `packages/gmt/src/calendar/hours/isOpenAt.ts`, `nextOpenAt.ts`, `nextCloseAt.ts` (one public function per file, the repo's convention):
  - `isOpenAt(isoString: string, schedule: OperatingSchedule, options?: { disambiguation? }): boolean`
  - `nextOpenAt(isoString: string, schedule: OperatingSchedule, options?: { within?: string, disambiguation? }): string` — The first open instant at or after the input (the input itself when open); `''` when none within the search horizon.
  - `nextCloseAt(isoString: string, schedule: OperatingSchedule, options?: { within?: string, disambiguation? }): string` — The first closed instant at or after the input (the input itself when closed).
- `packages/gmt/src/calendar/hours/operatingTimeBetween.ts`, `addOperatingTime.ts`:
  - `operatingTimeBetween(start: string, end: string, schedule: OperatingSchedule, options?: { disambiguation? }): string` — Exact open time elapsed, as an ISO duration.
  - `addOperatingTime(start: string, duration: string, schedule: OperatingSchedule, options?: { within?: string, disambiguation? }): string` — The instant at which `duration` of open time has elapsed; the service-level deadline.
- One walker, `packages/gmt/src/internal/operatingSchedule.ts`, serves all seven. Subpath `@northguild/gmt/calendar/hours`.

## Design notes

- **Windows are local wall times, so every edge inherits CORE-4.** A window edge that falls in a nonexistent local hour on a spring-forward night, or in a repeated hour on a fall-back night, is resolved with `resolveLocal` under the `disambiguation` option, which applies Temporal's [DisambiguatePossibleEpochNanoseconds](https://tc39.es/proposal-temporal/#sec-temporal-disambiguatepossibleepochnanoseconds), whose default (`'compatible'`) and behaviour are stated in the JSDoc using the [LOCAL_TIME_RESOLUTION.md](../../reference/LOCAL_TIME_RESOLUTION.md) vocabulary. A 23:00–06:00 window is 23 or 25 hours long on those nights, and the function says which.
- **Windows are half-open**, as [RFC 5545 §3.6.1](https://www.rfc-editor.org/rfc/rfc5545#section-3.6.1) (`DTEND` is non-inclusive) and SQL:2011's closed-open `PERIOD` (ISO/IEC 9075-2:2011) define a period: open at `from`, closed at `to`, consistent with CORE-6.
- **Midnight wrap is explicit in the type.** `{ from: '23:00', to: '06:00' }` on weekday 5 is Friday night into Saturday morning; the window is attributed to the weekday it starts on. Callers building curfews, night bans and circadian windows get one rule instead of five.
- **Holidays and overrides are dates in the schedule's zone**, consistent with CORE-7's `BusinessCalendar`, and a `BusinessCalendar` can be passed as `holidays` directly.
- **`operatingTimeBetween` and `addOperatingTime` are interval algebra**, not loops over minutes: intersect the open intervals with the range and sum (CORE-6), or walk open intervals until the duration is consumed. A deadline that would fall past `within` returns `''` rather than searching forever; the horizon default is stated.
- **This is not RFC 5545.** Weekly patterns with dated exceptions cover every consumer in the epic; monthly and yearly recurrence stay parked (see painpoints). The type is deliberately too small to become a recurrence engine.
- FIN-40's `MarketCalendar.sessions` are `LocalWindow`s with a phase tag and are resolved through `recurringWindows`; the two types share the edge semantics by construction.

## Decisions of record

- **Every function takes `disambiguation`.** The spec gave it to `recurringWindows` and `operatingIntervals` only; the LOCAL_TIME_RESOLUTION binding rule makes every function that resolves a wall time state and accept its policy, and `"reject"` is what a demurrage or duty clock wants.
- **Edges resolve independently with `resolveLocal`.** An edge pair that resolves to an empty or inverted span is dropped. The only case is a window no longer than the gap it straddles: Pacific/Chatham's 03:00–04:00 on 2024-09-29 moves its 03:00 edge an hour forward onto its own 04:00. A window is elapsed time between its resolved edges: New York's 23:00–06:00 is 8 hours across the fall-back night and 6 across the spring-forward one; 00:00–00:00 is 25 and 23.
- **`"reject"` is scoped to the answer.** A window with an ambiguous or nonexistent edge is not resolved. Its widest span (its `from` read `"earlier"`, its `to` read `"later"`) returns the sentinel only when it could change the answer: it overlaps the range; it could open before `nextOpenAt`'s answer; it starts at or before `nextCloseAt`'s answer; or it could add open time before `addOperatingTime`'s deadline. Without this, the result would depend on how far back the walk looks.
- **Dates come from the day walker behind `bucketRange` / `floorToZone`** (`internal/zonedBucket.ts`), from 72 hours before the first instant asked about. A window starting two days earlier can still be open when a deleted day lies between (Apia's Thursday 23:00 window ends at Saturday 06:00). A deleted date has no windows. A date the clock re-enters is resolved once.
- **The walk settles one date behind.** Under `"earlier"`, an edge in a gap moves back by the gap, so where a zone skips midnight a date's first window can open on the previous date (Africa/Cairo 2024-04-26, America/Santiago 2024-09-08). No zone has jumped forward by more than a day, so no window starts before the previous date's first instant, and a run is final once it ends before that. `"reject"`'s widest span uses the same `"earlier"` start and the same bound (PR #286 review).
- **Searches answer as soon as the answer is certain**, not when the run holding it closes: an open input is its own `nextOpenAt`, a closed one its own `nextCloseAt`, and a deadline inside an unending run is known once no later window can add time before it. A long `within` costs nothing when the answer is near.
- **Temporal's range limits clamp, never throw.** The lookback, the date limit and the horizon stop at Temporal's first and last instants, and an edge past them resolves just outside the range: it is clipped, never returned. A 24/7 schedule is open at both limit instants.
- **The interval algebra is the CORE-6 internal** (`coalesceIntervalNanoseconds`), not the public string functions. That is the same code, run on bigint nanoseconds. `operatingTimeBetween` equals `sumIntervals` of `intersectIntervals(operatingIntervals(...), range)`, and the tests assert it.
- **A `BusinessCalendar` passed as `holidays`** contributes its `holidays` only. `weekly` says which weekdays open, and `timeZone` on the schedule is the zone.
- **Two overrides for one date make the schedule invalid.** An override wins over a holiday on the same date.
- **The horizon defaults to `"P1Y"`**, added in the schedule's zone, and is inclusive. A range may span 10,000 local dates (`bucketRange`'s cap) counted from its start's date; a longer one is refused before walking, so it answers at once. A search that would go more than 10,000 dates past its input's date returns the sentinel.
- **`addOperatingTime` takes hours and smaller units.** `P1D` of open time could mean 24 open hours or one working day, so it returns `''`. `PT0S` returns the start.

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
