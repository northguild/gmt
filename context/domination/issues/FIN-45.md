# FIN-45 — Finance: Continuous and crypto market schedules

**Scope:** Markets that never close, and the periodic events that structure them.

## Gap

Crypto and some OTC markets trade 24/7, which sounds like it removes the problem and instead changes it. There is no trading day, no settlement cycle and no holiday calendar — but there are still periodic events on a fixed UTC schedule, and consumers need to know when the next one falls.

Perpetual futures accrue funding at fixed UTC intervals, dated instruments expire on a fixed weekday and hour, and daily statistics need a defined day boundary that no exchange agrees on. Applying the session model from FIN-40 to these markets produces nonsense; applying nothing produces bugs.

## Scope

- `packages/gmt/src/finance/calculate/fundingInterval.ts`:
  - `nextFundingTime(isoString: string, schedule: { intervalHours: number, offsetHours?: number }): string` — Next funding instant. Common schedules are eight-hourly at 00:00, 08:00 and 16:00 UTC.
  - `fundingTimesBetween(start: string, end: string, schedule): string[]`
- `packages/gmt/src/finance/calculate/expiryDate.ts`:
  - `expiryDate(period: { year: number, month: number }, rule: { weekday: number, ordinal: number | 'last', atUtcTime: string }): string | null` — Settlement expiry, e.g. the last Friday of the month at 08:00 UTC.
  - `nextExpiry(isoString: string, rule): string`
- `packages/gmt/src/finance/get/tradingDayBoundary.ts`:
  - `tradingDayBoundary(isoString: string, options: { boundary: 'utc' | 'exchangeLocal', timeZone?: string }): Interval` — The 24-hour window a timestamp belongs to, under an explicit boundary definition.

## Design notes

- **Schedules are parameters, not constants.** Eight-hourly funding at 00:00, 08:00 and 16:00 UTC is the most common convention, not a standard — venues differ, and some have changed theirs. Hardcoding a venue's schedule would make GMT wrong without warning when that venue changes.
- **`tradingDayBoundary` requires an explicit boundary choice** because there is no correct default. Venues variously use UTC midnight, 08:00 UTC, or a local exchange midnight, and a daily volume figure is meaningless without knowing which. Forcing the choice is the safeguard.
- **These markets have no business-day concept at all**, so nothing here composes with CORE-7. That is deliberate: reaching for a business calendar in a 24/7 market is the error this story exists to prevent, and the JSDoc should say so.
- Leap seconds and DST do not apply to UTC-anchored schedules, which is a genuine simplification. Local-boundary mode does inherit DST, and the two must not be conflated.

## What gmt provides (do not re-implement)

- `floorToZone` / `bucketRange` from CORE-5 — interval walking and day boundaries
- `intervalContains` from CORE-6 — window membership
- `addDuration` — interval arithmetic
- `getZonedDateTimeFields` — weekday extraction for expiry rules

## Verification

- `nextFundingTime` on an eight-hour schedule returns the next of 00:00, 08:00 or 16:00 UTC
- `nextFundingTime` called exactly at a funding instant returns the **next** one, not the same instant
- An offset schedule shifts every funding time by the offset
- `fundingTimesBetween` over a day on an eight-hour schedule returns three instants
- `expiryDate` with `ordinal: 'last'` and Friday returns the last Friday of the month, including months with five Fridays
- `expiryDate` with `ordinal: 3` returns the third occurrence
- `nextExpiry` from a date after that month's expiry returns the following month's
- `tradingDayBoundary` in `'utc'` mode returns midnight-to-midnight UTC
- `tradingDayBoundary` in `'exchangeLocal'` mode across a DST transition returns a 23- or 25-hour interval
- Omitting `timeZone` in local mode returns the sentinel
- `pnpm run validate` stays green
