# CORE-7 — Core: Business calendar engine

**Scope:** Holiday calendars, calendar composition, business-day arithmetic and roll conventions. The shared foundation under logistics, finance, rail and healthcare date math.

## Gap

The first draft siloed business-day math inside Finance (as `FIN-2`). That ordering is now impossible: logistics ships before finance, and logistics needs it first — working-day free time, customs filing deadlines, laytime exclusions and appointment windows are all business-day problems. Healthcare needs it for administrative deadlines and rail for engineering possessions.

Beyond weekends and holidays, the missing piece is **roll conventions**: what happens when a computed date lands on a non-business day. Every industry has an answer and they differ.

## Scope

- `packages/gmt/src/calendar/business/`:
  - `isBusinessDay(isoString: string, calendar: BusinessCalendar): boolean`
  - `addBusinessDays(isoString: string, count: number, calendar: BusinessCalendar): string` — Negative counts move backwards.
  - `businessDaysBetween(start: string, end: string, calendar: BusinessCalendar): number | null` — `start` exclusive, `end` inclusive. Convention stated in JSDoc, not inferred.
  - `nextBusinessDay(isoString: string, calendar: BusinessCalendar): string`
  - `previousBusinessDay(isoString: string, calendar: BusinessCalendar): string`
  - `rollDate(isoString: string, convention: RollConvention, calendar: BusinessCalendar): string`
  - `mergeCalendars(calendars: BusinessCalendar[]): BusinessCalendar` — Union of holidays and weekend rules. A date is a business day only if it is one in **every** input calendar.
- `BusinessCalendar` is `{ weekend: number[], holidays: string[], timeZone: string }`, exported from `packages/gmt/src/types/`.

## Roll conventions

| Convention | Behaviour |
| --- | --- |
| `following` | Move forward to the next business day |
| `modifiedFollowing` | Forward, unless that crosses into the next month, then backward |
| `preceding` | Move backward to the previous business day |
| `modifiedPreceding` | Backward, unless that crosses into the previous month, then forward |
| `endOfMonth` | If the unadjusted date is the last day of its month, the result is the last business day of the target month |
| `none` | Return unadjusted |

`modifiedFollowing` with the end-of-month rule is the common convention for interest-rate instruments. ([FINCAD](https://docs.fincad.com/support/developerfunc/mathref/Daycount.htm))

## Design notes

- **Weekends are not universally Saturday and Sunday.** Much of the Middle East uses Friday–Saturday, and some markets have a one-day weekend. `weekend` is an explicit array of ISO weekday numbers, never assumed.
- **`mergeCalendars` is the reason this is core, not finance.** FX settlement needs both currencies' calendars (FIN-43); an intermodal move needs the origin port's and the destination port's; a cross-border rail path needs both national calendars. One implementation, four consumers.
- **Holidays are caller-supplied data.** GMT bundles no holiday table on the default import path. Convenience calendars for named exchanges live behind an opt-in `…/data` subpath (FIN-41). Holiday data is jurisdictional, changes annually and sometimes with days of notice — baking it into core would make GMT wrong on a schedule.
- Calendars carry a `timeZone` because "is this a business day" is a question about a local date, not an instant.

## Corrections

This story absorbs the original `FIN-2`. That spec defaulted `exchange` to `NYSE` and stated that its functions "return `""` sentinel if input date is not a valid business day" — which would make `nextBusinessDay` unusable, since its entire purpose is to be called from a non-business day. Both are dropped: there is no default calendar, and a non-business-day input is the normal case.

## What gmt provides (do not re-implement)

- `addZoned` / `subtractZoned` — date arithmetic
- `getZonedDateTimeFields` — day-of-week extraction
- `floorToZone` from CORE-5 — local date boundaries
- `resolveLocal` from CORE-4 — local date to instant

## Verification

- `addBusinessDays` skips weekends and holidays in both directions
- `addBusinessDays(iso, 0, cal)` is identity, including when `iso` is not a business day
- `businessDaysBetween` with the documented exclusive/inclusive convention is asserted explicitly
- `rollDate` with `modifiedFollowing` on a month-end Friday holiday rolls **backward**, not forward
- `endOfMonth` maps a month-end input to the last business day of the target month
- `mergeCalendars` excludes a date that is a holiday in either input
- Friday–Saturday weekend calendar behaves correctly
- `pnpm run validate` stays green
