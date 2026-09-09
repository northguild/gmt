# FIN-41 — Finance: Exchange and currency calendars

**Scope:** The opt-in reference calendar data set, and the tooling to keep it honest.

## Gap

CORE-7 provides the business-calendar engine and FIN-40 the session model, but both take calendars as parameters. Someone has to supply them, and expecting every consumer to hand-assemble NYSE holidays is not a serious answer for a library claiming to serve finance.

The tension is real: bundled holiday data is genuinely useful and genuinely goes stale. Exchange holidays are set annually, and governments add one-off closures with days of notice.

## Scope

- `packages/gmt/src/finance/data/` — published **only** at the `@northguild/gmt/finance/data` subpath, never from the realm root or the package root.
  - `exchangeCalendar(code: string, year: number): MarketCalendar | null` — Reference calendar for a supported exchange and year.
  - `currencyCalendar(code: string, year: number): BusinessCalendar | null` — Settlement calendar for a currency, for FIN-43.
  - `supportedExchanges(): { code: string, name: string, timeZone: string, coverage: { from: number, to: number } }[]`
  - `dataProvenance(): { source: string, revision: string, generatedAt: string, coverageEndsAt: string }`
- `packages/gmt/src/finance/validate/calendarFreshness.ts`:
  - `isCalendarStale(at: string, calendar: MarketCalendar): boolean` — Whether the requested date falls beyond the calendar's verified coverage.

## Phase 1 coverage

NYSE, NASDAQ, LSE, TYO, EURONEXT for exchanges; USD, EUR, GBP, JPY for currencies.

## Design notes

- **Subpath isolation is the architectural point.** Bundled data is opt-in and tree-shakeable, so importing `@northguild/gmt/finance` never pulls holiday tables into a bundle. This is the epic-wide rule stated in the tracker's Definition of Done, and finance is where it is most tempting to break.
- **`dataProvenance` and `isCalendarStale` exist because the data expires.** A library that silently returns a 2026 calendar for a 2029 date is worse than one that returns nothing: the caller gets plausible dates and no signal. Querying beyond verified coverage must be detectable.
- **Reference calendars are a convenience, not an authority.** The JSDoc must say that production settlement systems should supply their own verified calendars. GMT is not a market-data vendor and must not imply it is.
- Each calendar records its source and revision, per the tracker's rule on bundled reference data.

## Corrections

This story is what remains of the original `FIN-2` after its business-day arithmetic moved to CORE-7. That relocation was forced by the reprioritisation: logistics now ships before finance and needs business-day math, so it could not stay behind an exchange-calendar story. What is left here is the data, correctly scoped.

The original also defaulted `exchange` to `NYSE`. There is no default exchange — a silently assumed calendar is a silently wrong settlement date.

## What gmt provides (do not re-implement)

- `BusinessCalendar` / `mergeCalendars` from CORE-7 — calendar shape and composition
- `MarketCalendar` from FIN-40 — session shape

## Verification

- `exchangeCalendar('NYSE', 2026)` includes the known US market holidays for that year
- The NYSE calendar marks the day after Thanksgiving as a half day
- `exchangeCalendar` for an unsupported code or an uncovered year returns the sentinel
- `isCalendarStale` returns `true` for a date beyond `coverageEndsAt`
- `dataProvenance` reports a non-empty source and revision
- Importing `@northguild/gmt/finance` does not pull the data module into the bundle, asserted by a bundle-size check
- `currencyCalendar('USD', 2026)` and the NYSE calendar differ, since bank and exchange holidays are not identical
- `pnpm run validate` stays green
