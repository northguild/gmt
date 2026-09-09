# FIN-40 — Finance: Market sessions

**Scope:** Whether a market is open, modelled as a list of intervals rather than a single window.

## Gap

The original `isMarketOpen(isoString, exchange)` returns wrong answers for two common cases it did not consider.

- **Lunch breaks.** Tokyo and Hong Kong close for lunch mid-session. A single open/close pair reports the market open when it is not.
- **Half days.** The day after US Thanksgiving and Christmas Eve close early. A fixed close time reports the market open after it has shut.

The correct model is that a trading day is an ordered **list** of intervals — pre-market, opening auction, continuous, lunch, continuous, closing auction, post-market — and any of them may be absent or shortened on a given date.

## Scope

- `packages/gmt/src/finance/get/tradingSessions.ts`:
  - `tradingSessions(date: string, calendar: MarketCalendar): { phase: SessionPhase, interval: Interval }[] | null` — Every session on a date, in order. Empty array on a non-trading day.
- `packages/gmt/src/finance/compare/isMarketOpen.ts`:
  - `isMarketOpen(isoString: string, calendar: MarketCalendar, options?: { phases?: SessionPhase[] }): boolean` — Defaults to continuous trading only; `phases` widens it to pre- or post-market.
  - `currentPhase(isoString: string, calendar: MarketCalendar): SessionPhase | 'closed' | null`
- `packages/gmt/src/finance/get/marketBounds.ts`:
  - `marketOpenAt(date: string, calendar: MarketCalendar): string` — First continuous-session open.
  - `marketCloseAt(date: string, calendar: MarketCalendar): string` — Last continuous-session close, reflecting half-day overrides.
- `SessionPhase` is `'preMarket' | 'openingAuction' | 'continuous' | 'lunch' | 'closingAuction' | 'postMarket'`.
- `MarketCalendar` is `{ timeZone: string, weekend: number[], sessions: SessionTemplate[], holidays: string[], halfDays: { date: string, sessions: SessionTemplate[] }[] }`.

## Design notes

- **`isMarketOpen` defaults to continuous trading**, because that is what the question almost always means, but the phase list makes the alternative reachable. A boolean with no phase concept cannot distinguish "open" from "quotable".
- **Half days are date-keyed session overrides**, not a shortened close time — some half days also drop the closing auction, which a close-time override cannot express.
- **The calendar is caller-supplied.** Exchange calendars change annually and by regulatory action. Convenience calendars ship behind the opt-in `@northguild/gmt/finance/data` subpath (FIN-41), never on the default import path.
- **US and EU DST transitions do not coincide** — there are roughly three weeks each spring and autumn when the London–New York overlap shifts by an hour. Sessions are defined in local time and resolved per date, so this falls out correctly rather than needing special handling; the test matrix must cover those weeks.

## Corrections

The original FIN-1 hardcoded a five-exchange table with a single `Hours (local)` column, including `TYO 09:00–15:00 JST` — which ignores the lunch break and would report the Tokyo market open at 12:00. Its design note deferred pre-market and after-hours "not in scope for v1", which is reasonable, but the single-interval model made them unrepresentable rather than merely unimplemented.

## What gmt provides (do not re-implement)

- `intervalContains` / `mergeIntervals` from CORE-6 — session membership
- `BusinessCalendar` / `isBusinessDay` from CORE-7 — trading-day determination
- `resolveLocal` from CORE-4 — local session boundaries
- `floorToZone` from CORE-5 — local date boundaries

## Verification

- A calendar with a lunch break reports `isMarketOpen` as `false` during lunch and `true` either side
- `currentPhase` returns `'lunch'` at that time, not `'closed'`
- A half-day override returns an earlier `marketCloseAt` than the same weekday normally
- A half day that drops the closing auction returns no such session
- A holiday returns an empty session list and `marketOpenAt` of `''`
- `isMarketOpen` with `phases: ['preMarket', 'continuous']` returns `true` before the open
- Sessions resolve correctly during the spring weeks when US and EU DST are misaligned
- Full IANA timezone coverage
- `pnpm run validate` stays green
