# INT-12 — Intermodal: Free time, demurrage and detention

**Scope:** When the free-time clock starts, when it expires, and how many days are chargeable.

## Gap

This is the money calculation in container logistics, and the first draft reduced it to a boolean against a hardcoded per-port table. The real model has five parameters, none of which is the port:

- **Which clock.** Demurrage runs from discharge from the vessel until the container leaves the terminal gate. Detention runs from gate-out until the empty is returned. Terminal **storage** runs over the same window as demurrage but is the terminal's charge, with its own free time. Three clocks, frequently confused.
- **Which start day.** Whether the day of the triggering event counts as free day one, or free time starts the following day, is a tariff term. The two conventions differ by a full day of charges.
- **Which basis.** Most carriers count **calendar days**; some tariffs count **working days**, and usually only for detention. On calendar days a weekend burns two free days while the terminal is shut.
- **Whose calendar.** Working-day counting needs the terminal's holiday calendar.
- **Which contract.** Free time varies by carrier, lane, trade and service contract.

US invoices are now regulated: 46 CFR Part 541 requires a demurrage or detention invoice to state the allowed free time in days, the start and end dates of free time, the container availability date (imports) or earliest return date (exports), and the specific dates for which charges were assessed. Those are exactly this story's outputs.

([ACL](https://www.aclcargo.com/free-time-demurrage/), [Navo24](https://navo24.com/blog/msc-demurrage-detention-free-time/), [46 CFR 541.6](https://www.law.cornell.edu/cfr/text/46/541.6))

## Scope

- `packages/gmt/src/intermodal/calculate/freeTimeExpiry.ts`:
  - `freeTimeExpiry(clockStart: string, freeDays: number, options: { basis: 'calendar' | 'working', timeZone: string, firstDay: 'eventDay' | 'nextDay', calendar?: BusinessCalendar }): { freeTimeStart: string, lastFreeDay: string, expiresAt: string } | null` — `freeTimeStart` and `lastFreeDay` are local dates; `expiresAt` is the instant free time ends (the start of the local day after `lastFreeDay`). Working-day basis requires `calendar`.
- `packages/gmt/src/intermodal/calculate/chargeableDays.ts`:
  - `chargeableDays(clockStart: string, clockEnd: string, freeDays: number, options: FreeTimeOptions & { tiers?: number[] }): { freeDaysUsed: number, chargeableDays: number, expiresAt: string, chargedDates: string[], byTier: { from: number, to: number | null, days: number }[] } | null` — Days beyond free time, the local dates they fell on, and — when `tiers` gives band boundaries in chargeable-day ordinals, e.g. `[5, 10]` for days 1–5, 6–10 and 11 onward — how many days fell in each band.
- `packages/gmt/src/intermodal/calculate/demurrageClock.ts`:
  - `demurrageClock(events: { type: 'discharged' | 'available' | 'gatedOut' | 'emptyReturned', at: string }[], scope: 'demurrage' | 'detention' | 'storage', options?: { startEvent?: 'discharged' | 'available' }): { start: string, end: string } | null` — Selects the correct start and end events for the requested charge. Demurrage and storage run from discharge (or availability, where the tariff says so) to gate-out; detention runs from gate-out to empty return.
- Docs site (`apps/dox/src/content/docs/`, per [../docs-site.md](../docs-site.md)):
  - `guides/industries/intermodal-free-time-and-demurrage.mdx` — the three clocks, which day is
    day one, calendar or working days, the half-open expiry, charged dates and tiers, and what
    46 CFR 541.6 makes an invoice print, ported from the README section.
  - Scenarios: `free-time-start-day` (`freeTimeExpiry`), `demurrage-across-a-weekend`
    (`chargeableDays`), `detention-is-not-demurrage` (`demurrageClock`).
  - `mistakes/intermodal.mdx` — a defaulted `firstDay`, a per-port free-time table, counting in
    UTC, charging the gate-out at `expiresAt`, working days without a calendar, detention from
    discharge, hours divided by 24, rates inside the day count.
  - Index entries in `guides/industries/index.mdx`, `guides/index.mdx` and `mistakes/index.mdx`.
  - The Free Time Ledger (`tools/free-time-ledger.mdx`): the Dwell Ledger's real local-day grid
    with each day coloured as the tariff reads it (uncounted event day, free, closed, chargeable
    with tier boundaries and the expiry line), `firstDay` and `basis` controls, a weekend picker
    and holiday list on the working basis, and the real `freeTimeExpiry` and `chargeableDays`
    results. It is the Dox chat tool
    `showFreeTimeLedger({ clockStart, clockEnd, freeDays, firstDay, basis, zone, weekend?, holidays?, tiers? })`;
    the guide and the scenarios link to it. Its permalink carries every list and number as a
    string, because `seedFromLocation` passes only strings.

## Design notes

- **Day boundaries are local to the terminal**, so every count comes from `dwellTime` (TRAN-8) and `floorToZone` (CORE-5), never from dividing elapsed hours by 24. A container discharged at 23:00 has used a free day by 00:01 under `firstDay: 'eventDay'`.
- **`firstDay` has no default.** Tariffs differ, the difference is one full day of charges, and a silent default here is a wrong invoice. Same rule as `freeDays`.
- **Half-open counting.** Gate-out at exactly `expiresAt` is not a chargeable day. See CORE-6 for why the convention is fixed library-wide.
- **`chargedDates` is the list an FMC-compliant invoice has to print** ("the specific date(s) for which demurrage and/or detention were charged", 46 CFR 541.6). Returning it makes the count auditable instead of asserted.
- **Tiers are day bands, not rates.** Carrier tariffs escalate by day band; `byTier` returns the days in each band so the consumer can apply its own rates. GMT computes days, never money.
- `available` exists because some tariffs start the import clock at the container availability date rather than at discharge, and 46 CFR 541.6 requires that date on the invoice. `startEvent` selects it explicitly; the default is `'discharged'` because that is the classic definition of demurrage.
- Working-day basis suspends the clock on weekends and holidays; calendar basis does not. Both are implemented over the same interval algebra so they cannot drift apart.
- Invoice, dispute and resolution deadlines under 46 CFR 541.7–541.8 are INT-58's problem; this story stops at the day count.

Decisions of record (owner, 2026-09-24):

- **Both results name the expiry instant `expiresAt`.** The first draft wrote `expiredAt` in
  `chargeableDays`; one name for one instant, and INT-58 reads both results.
- **`freeDays: 0`** is a tariff with no free time. `chargeableDays` accepts it (every counted day
  is charged, `expiresAt` is the start of day one); `freeTimeExpiry` returns `null`, because
  there is no last free day to name (no invented quantities).
- **One walker for both bases.** `internal/freeTimeLedger.ts` walks the zone's real local-day
  buckets from the clock start with `zonedUnitStart` / `nextZonedBucketStart`
  (`internal/zonedBucket.ts`, what `floorToZone` and `bucketRange` are built on). The working
  basis drops buckets whose date is not a business date; the calendar basis keeps every bucket.
  A date already visited is folded into its day (Goose Bay's fall-back re-enters the 6th and
  starts the 7th twice), matching `countZonedLocalDates`. Cap: 10,000 local days, then the
  sentinel. Day one under `eventDay` is the clock-start bucket, or on the working basis the first
  counted bucket at or after it; under `nextDay` the first counted bucket strictly after it.
  `expiresAt` is the start of the bucket after the last free bucket, whether or not that bucket
  counts, so on the working basis it can be a Saturday 00:00 that is simply not chargeable.
- **Used and charged are half-open at the exit.** A day is touched when it starts before
  `clockEnd`, and a zero-length dwell touches its own day, as `dwellTime` counts; tests assert
  `freeDaysUsed + chargeableDays === dwellTime(...).calendarDays` on the calendar basis.
- **`byTier` always lists every band**, empty ones with `days: 0`, and the last is open; omitted
  or `[]` tiers give the single open band `{ from: 1, to: null }`. Tiers must be strictly
  ascending positive whole numbers.
- **`demurrageClock` validates every event**, used or not, and returns `null` for a required
  event present twice. `startEvent` is not read for `detention`, so one options object can
  serve all three scopes. The result is an `Interval` in the caller's own strings.
- **Type names avoid a case-only clash with a function name** (`FreeTimeCharges`, not
  `ChargeableDays`): the reference generator refuses two pages whose paths differ only by case.
- `FreeTimeOptions`, `FreeTimeBasis` and `FreeTimeFirstDay` live in `types/`, as `BusinessCalendar`
  does; result types live beside their function, as `Dwell` does.

## What gmt provides (do not re-implement)

- `dwellTime` from TRAN-8 — the underlying dwell measurement and the local calendar-day count
- `BusinessCalendar` / `isBusinessDay` / `addBusinessDays` from CORE-7 — working-day counting
- `subtractIntervals` / `sumIntervals` from CORE-6 — suspending the clock across closures
- `floorToZone` from CORE-5 — local day boundaries

## Verification

- Calendar basis, `firstDay: 'eventDay'`: a Friday discharge with three free days makes Sunday the last free day and expires at Monday 00:00 local, consuming the weekend
- The same input with `firstDay: 'nextDay'` makes Monday the last free day — the two conventions differ by exactly one day, asserted explicitly
- Working basis with the same input expires Wednesday, having skipped the weekend
- A terminal holiday inside the window extends working-basis expiry by one day and leaves calendar-basis expiry unchanged
- Gate-out exactly at `expiresAt` returns `chargeableDays: 0` and an empty `chargedDates`
- Gate-out one second later returns `chargeableDays: 1` and one charged date
- `tiers: [5, 10]` over twelve chargeable days returns bands of 5, 5 and 2
- `demurrageClock` with `scope: 'detention'` selects gate-out to empty-return, not discharge
- `demurrageClock` with `startEvent: 'available'` starts at the availability event and returns the sentinel when that event is missing
- Missing required event returns the sentinel
- Working basis without a `calendar`, or a missing `firstDay`, returns the sentinel
- Probe-zone rows: Santiago's skipped midnight starts the day at 01:00; Apia's deleted
  2011-12-30 is never a free or charged date; Goose Bay's re-entered 6 November and twice-started
  7 November are one day each; the 25-hour fall-back day counts once
- Every result on the docs-site pages matches the built package, and every internal link on
  them resolves
- Each Free Time Ledger preset prints the JSDoc example it draws, asserted in the mount test,
  and its coloured cells equal `chargedDates` and `freeDaysUsed`
- The chat parity tests pass with the sixth tool; `html-diff` reports the new page as having no
  baseline and `visual:diff` shows changes on the new page only; a keyboard-only pass and a
  `prefers-reduced-motion` check pass
- `pnpm run validate` stays green
