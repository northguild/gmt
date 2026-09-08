# FIN-2 — Finance: Business day math — `nextBusinessDay` + `businessDaysBetween`

**Scope:** Business day arithmetic for trading and financial applications.

## Gap

Finance applications need to skip weekends and holidays for settlement dates, option expiration, and other business day calculations.

## Scope

- `packages/gmt/src/finance/business-days.ts`:
  - `nextBusinessDay(isoString: string, options?: { exchange?: string, holidays?: string[] }): string` — Next business day. Skips weekends and holidays.
  - `previousBusinessDay(isoString: string, options?: { exchange?: string, holidays?: string[] }): string` — Previous business day.
  - `businessDaysBetween(start: string, end: string, options?: { exchange?: string, holidays?: string[] }): number` — Count business days from `start` (exclusive) to `end` (inclusive).

## Design notes

- `holidays` array takes precedence over `exchange` calendar.
- `exchange` defaults to `NYSE`.
- All functions return `""` sentinel if input date is not a valid business day.
- Holiday table from FIN-1 is shared here.

## What gmt provides (do not re-implement)

- `getZonedDateTimeFields` — day-of-week extraction
- `addZoned` / `subtractZoned` — date arithmetic
- `isValidZonedDateTime` — validation

## Verification

- `nextBusinessDay` skips Saturday, Sunday, and known holidays
- `previousBusinessDay` skips backwards correctly
- `businessDaysBetween('2024-12-24', '2024-12-31')` correct count (excludes Christmas)
- Unknown exchange with no holidays: fall back to weekends-only
- `pnpm run validate` stays green
