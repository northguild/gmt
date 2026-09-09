# INT-12 — Intermodal: Free time, demurrage and detention

**Scope:** When the free-time clock starts, when it expires, and how many days are chargeable.

## Gap

This is the money calculation in container logistics, and the first draft reduced it to a boolean against a hardcoded per-port table. The real model has four parameters, none of which is the port:

- **Which clock.** Demurrage runs from discharge from the vessel until the container leaves the terminal gate. Detention runs from gate-out until the empty is returned. Two different events, two different clocks, frequently confused.
- **Which basis.** Most carriers count **calendar days**; some tariffs count **working days**, and usually only for detention. On calendar days a weekend burns two free days while the terminal is shut.
- **Whose calendar.** Working-day counting needs the terminal's holiday calendar.
- **Which contract.** Free time varies by carrier, lane, trade and service contract.

([ACL](https://www.aclcargo.com/free-time-demurrage/), [Navo24](https://navo24.com/blog/msc-demurrage-detention-free-time/))

## Scope

- `packages/gmt/src/intermodal/calculate/freeTimeExpiry.ts`:
  - `freeTimeExpiry(clockStart: string, freeDays: number, options: { basis: 'calendar' | 'working', timeZone: string, calendar?: BusinessCalendar }): string` — The instant free time expires. Working-day basis requires `calendar`.
- `packages/gmt/src/intermodal/calculate/chargeableDays.ts`:
  - `chargeableDays(clockStart: string, clockEnd: string, freeDays: number, options): { freeDaysUsed: number, chargeableDays: number, expiredAt: string } | null` — Days beyond free time.
- `packages/gmt/src/intermodal/calculate/demurrageClock.ts`:
  - `demurrageClock(events: { type: 'discharged' | 'gatedOut' | 'emptyReturned', at: string }[], scope: 'demurrage' | 'detention'): { start: string, end: string } | null` — Selects the correct start and end events for the requested charge type.

## Design notes

- **Day boundaries are local to the terminal**, so the count comes from `floorToZone` (CORE-5), not from dividing elapsed hours by 24. A container discharged at 23:00 has used a free day by 00:01.
- **Half-open counting.** Gate-out at exactly the expiry instant is not a chargeable day. See CORE-6 for why the convention is fixed library-wide.
- **`freeDays` is a contract term supplied by the caller.** There is no default and no bundled table. A wrong default here is a wrong invoice.
- Working-day basis suspends the clock on weekends and holidays; calendar basis does not. Both are implemented over the same interval algebra so they cannot drift apart.
- GMT computes days, never money. Rates, currencies and tariff tiers are the consumer's problem.

## What gmt provides (do not re-implement)

- `terminalDwell` from INT-11 — the underlying dwell measurement
- `BusinessCalendar` / `isBusinessDay` / `addBusinessDays` from CORE-7 — working-day counting
- `subtractIntervals` / `sumIntervals` from CORE-6 — suspending the clock across closures
- `floorToZone` from CORE-5 — local day boundaries

## Verification

- Calendar basis: a Friday discharge with three free days expires Monday, consuming the weekend
- Working basis with the same input expires Wednesday, having skipped the weekend
- A terminal holiday inside the window extends working-basis expiry by one day and leaves calendar-basis expiry unchanged
- Gate-out exactly at the expiry instant returns `chargeableDays: 0`
- Gate-out one second later returns `chargeableDays: 1`
- `demurrageClock` with `scope: 'detention'` selects gate-out to empty-return, not discharge
- Missing required event returns the sentinel
- Working basis without a `calendar` returns the sentinel
- `pnpm run validate` stays green
