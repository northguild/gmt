# FIN-41 — Finance: Exchange and payment-system calendars

**Scope:** The opt-in reference calendar data set — calendars published by exchanges and payment-system operators — and the tooling to keep it honest.

## Gap

CORE-7 provides the business-calendar engine and FIN-40 the session model, but both take calendars as parameters. Someone has to supply them, and expecting every consumer to hand-assemble NYSE holidays is not a serious answer for a library claiming to serve finance.

The tension is real: bundled calendar data is genuinely useful and genuinely goes stale. Exchanges and payment systems publish their closing days annually and add one-off closures with days of notice.

## Scope

- `packages/gmt/src/finance/data/` — published **only** at the `@northguild/gmt/finance/data` subpath, never from the realm root or the package root.
  - `exchangeCalendar(code: string, year: number): MarketCalendar | null` — Reference calendar for a supported exchange and year.
  - `paymentSystemCalendar(code: string, year: number): BusinessCalendar | null` — The closing days an operator publishes (for example a central-bank RTGS or a national payment system), for FIN-43's settlement calendars.
  - `supportedCalendars(): { code: string, kind: 'exchange' | 'paymentSystem', name: string, timeZone: string, coverage: { from: number, to: number } }[]`
  - `dataProvenance(): { source: string, revision: string, generatedAt: string, coverageEndsAt: string }`
- `packages/gmt/src/finance/validate/calendarFreshness.ts`:
  - `isCalendarStale(at: string, calendar: MarketCalendar): boolean` — Whether the requested date falls beyond the calendar's verified coverage.

## Phase 1 coverage

NYSE, NASDAQ, LSE, TYO, EURONEXT for exchanges; TARGET plus the operators of the USD, GBP and JPY large-value payment systems for payment systems — codes to be confirmed against each operator's published calendar.

## Design notes

- **Subpath isolation is the architectural point.** Bundled data is opt-in and tree-shakeable, so importing `@northguild/gmt/finance` never pulls calendar tables into a bundle. This is the epic-wide rule stated in the tracker's Definition of Done, and finance is where it is most tempting to break.
- **No national holiday set ships.** A country's public holidays are law; the calendars here are the operators' own, each cited to the operator that published it.
- **`dataProvenance` and `isCalendarStale` exist because the data expires.** A library that silently returns a 2026 calendar for a 2029 date is worse than one that returns nothing: the caller gets plausible dates and no signal. Querying beyond verified coverage must be detectable.
- **Reference calendars are a convenience, not an authority.** The JSDoc must say that production settlement systems should supply their own verified calendars. GMT is not a market-data vendor and must not imply it is.
- Each calendar records its source and revision, per the tracker's rule on bundled reference data.

## Corrections

This story is what remains of the original `FIN-2` after its business-day arithmetic moved to CORE-7. That relocation was forced by the reprioritisation: logistics now ships before finance and needs business-day math, so it could not stay behind an exchange-calendar story. What is left here is the data, correctly scoped.

The original also defaulted `exchange` to `NYSE`. There is no default exchange — a silently assumed calendar is a silently wrong settlement date.

`currencyCalendar` was a country holiday set under a currency code; removed. Settlement calendars are the payment-system operator's own closing days, exposed as `paymentSystemCalendar` and keyed as FIN-43 documents, and no national holiday set ships.

## What gmt provides (do not re-implement)

- `BusinessCalendar` / `mergeCalendars` from CORE-7 — calendar shape and composition
- `MarketCalendar` from FIN-40 — session shape

## Verification

- `exchangeCalendar('NYSE', 2026)` includes the exchange's published holidays for that year
- The NYSE calendar marks the exchange's published late-November early close as a half day
- `exchangeCalendar` for an unsupported code or an uncovered year returns the sentinel
- `isCalendarStale` returns `true` for a date beyond `coverageEndsAt`
- `dataProvenance` reports a non-empty source and revision
- Importing `@northguild/gmt/finance` does not pull the data module into the bundle, asserted by a bundle-size check
- `paymentSystemCalendar('TARGET', 2026)` and `exchangeCalendar('EURONEXT', 2026)` differ, since payment-system and exchange closings are not identical
- `supportedCalendars()` lists every code the two lookups accept, each with its `kind`
- `pnpm run validate` stays green
