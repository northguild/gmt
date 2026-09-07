# FIN-1 — Finance: Market hours — `isMarketOpen` + `marketOpenAt` + `marketCloseAt`

**Scope:** Determine whether a timestamp is during market hours for a specific exchange.

## Gap

Finance applications need to check if a timestamp falls within trading hours and get open/close times. Requires exchange-specific market hour tables.

## Scope

- `packages/gmt/src/finance/market-hours.ts`:
  - `isMarketOpen(isoString: string, exchange: string): boolean` — `true` if within trading hours. Checks: weekday, not a holiday, within market hours.
  - `marketOpenAt(isoString: string, exchange: string): string` — Market open time for the day containing this timestamp. `""` if not a trading day.
  - `marketCloseAt(isoString: string, exchange: string): string` — Market close time for the day containing this timestamp. `""` if not a trading day.

## Exchange support (Phase 1)

| Exchange | Code | Hours (local) | Timezone |
|----------|------|--------------|----------|
| NYSE | `NYSE` | 09:30–16:00 ET | America/New_York |
| NASDAQ | `NASDAQ` | 09:30–16:00 ET | America/New_York |
| LSE | `LSE` | 08:00–16:30 GMT/BST | Europe/London |
| Tokyo | `TYO` | 09:00–15:00 JST | Asia/Tokyo |
| Euronext | `EURONEXT` | 09:00–17:30 CET | Europe/Paris |

Holiday data: hardcoded static table of major public holidays for NYSE and LSE.

## Design notes

- Pre-market and after-hours: not in scope for v1.
- Exchange codes are case-insensitive.

## What gmt provides (do not re-implement)

- `getZonedDateTimeFields` — day-of-week, hour, minute
- `isValidTimeZone` — validate exchange timezone

## Verification

- Known trading day/hour returns `true`
- Weekend returns `false`
- Known NYSE holiday returns `false`
- `marketOpenAt` / `marketCloseAt` return correct times
- Unknown exchange returns `false` / `""`
- `pnpm run validate` stays green
