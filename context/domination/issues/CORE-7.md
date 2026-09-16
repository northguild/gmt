# CORE-7 — Core: Business calendar engine

**Scope:** Holiday calendars, calendar composition, business-day arithmetic and roll conventions. The shared foundation under logistics, finance, rail and healthcare date math.

## Gap

The first draft siloed business-day math inside Finance (as `FIN-2`). That ordering is now impossible: logistics ships before finance, and logistics needs it first — working-day free time, customs filing deadlines, laytime exclusions and appointment windows are all business-day problems. Healthcare needs it for administrative deadlines and rail for engineering possessions.

Beyond weekends and holidays, the missing piece is **roll conventions**: what happens when a computed date lands on a non-business day. Every industry has an answer and they differ.

## Scope

- `packages/gmt/src/calendar/business/`:
  - `businessDaysBetween(start: string, end: string, calendar: BusinessCalendar): number | null` — `start` exclusive, `end` inclusive. Convention stated in JSDoc, not inferred.
  - `nextBusinessDay(isoString: string, calendar: BusinessCalendar): string` — strictly after.
  - `previousBusinessDay(isoString: string, calendar: BusinessCalendar): string` — strictly before.
  - `rollDate(isoString: string, convention: RollConvention, calendar: BusinessCalendar): string`
  - `mergeCalendars(calendars: BusinessCalendar[]): BusinessCalendar | null` — Union of holidays and weekend rules. A date is a business day only if it is one in **every** input calendar.
- Extended in place, keeping their published `plain/` subpath (see Corrections):
  - `isBusinessDay(isoString: string, calendar?: BusinessCalendar): boolean`
  - `addBusinessDays(isoString: string, count: number, calendar?: BusinessCalendar): string` — Negative counts move backwards.
  - `subtractBusinessDays(isoString: string, count: number, calendar?: BusinessCalendar): string`
- `packages/gmt/src/calendar/validate/`:
  - `isValidBusinessCalendar(calendar: unknown): calendar is BusinessCalendar`
  - `isValidRollConvention(convention: unknown): convention is RollConvention`
- `BusinessCalendar` is `{ weekend: number[], holidays: string[], timeZone: string }`, exported from `packages/gmt/src/types/`, alongside `RollConvention`.

## Roll conventions

| Convention | Behaviour |
| --- | --- |
| `following` | Move forward to the next business day |
| `modifiedFollowing` | Forward, unless that crosses into the next month, then backward |
| `preceding` | Move backward to the previous business day |
| `modifiedPreceding` | Backward, unless that crosses into the previous month, then forward |
| `endOfMonth` | The last business day of the date's own month, wherever in the month the date falls |
| `none` | Return unadjusted |

The first four are defined by [ISDA 2006 Definitions §4.12(a)](https://www.isda.org/book/2006-isda-definitions/) — the text that governs them, since no TC39, ECMA or RFC standard does — and `none` is what [OpenGamma Strata](https://strata.opengamma.io/apidocs/com/opengamma/strata/basics/date/BusinessDayConventions.html) calls `NO_ADJUST`. `endOfMonth` is GMT's own primitive: it is neither an ISDA business-day convention nor the industry "EOM rule", which is a schedule rule rather than a roll.

## Design notes

- **Weekends are not universally Saturday and Sunday.** Much of the Middle East uses Friday–Saturday, and some markets have a one-day weekend. `weekend` is an explicit array of ISO weekday numbers, never assumed.
- **`mergeCalendars` is the reason this is core, not finance.** FX settlement needs both currencies' calendars (FIN-43); an intermodal move needs the origin port's and the destination port's; a cross-border rail path needs both national calendars. One implementation, four consumers.
- **Holidays are caller-supplied data.** GMT bundles no holiday table on the default import path. Convenience calendars for named exchanges live behind an opt-in `…/data` subpath (FIN-41). Holiday data is jurisdictional, changes annually and sometimes with days of notice — baking it into core would make GMT wrong on a schedule.
- Calendars carry a `timeZone` because "is this a business day" is a question about a local date, not an instant. The field records which locality the calendar describes; the business-day functions never read it, because they take and return local dates. It is what a consumer holding an instant needs, to know which zone to reduce it in first — with `floorToZone` — before asking.

## Corrections

This story absorbs the original `FIN-2`. That spec defaulted `exchange` to `NYSE` and stated that its functions "return `""` sentinel if input date is not a valid business day" — which would make `nextBusinessDay` unusable, since its entire purpose is to be called from a non-business day. Both are dropped: there is no default calendar, and a non-business-day input is the normal case.

**`isBusinessDay` and `addBusinessDays` were already shipped.** Both existed in `plain/` as
fixed Monday–Friday functions, and `plain/*` is a published subpath, so neither the name nor
the location was free. They were extended in place with an optional trailing `calendar`
instead: omitting it reproduces the shipped behaviour exactly, so no existing call changes,
and `calendar/business/` re-exports the same bindings so the family still reads as one unit.
`subtractBusinessDays` came along for symmetry. Decided with the owner before implementation.

**`endOfMonth` snaps from anywhere in the month, not only from a month-end date.** As
originally worded — "if the unadjusted date is the last day of its month" — the convention was
a no-op: `modifiedFollowing` already returns the last business day of the month for a month-end
input, because rolling forward from it always crosses into the next month. The rule only earns
its place if it snaps unconditionally, which is also the primitive tenor arithmetic needs: the
caller tests the *anchor* for month-end and applies `endOfMonth` to the unadjusted target, so
"the result is the last business day of the target month" holds (FIN-43, FIN-44).

**The shared business-day walker was recursive and overflowed the stack.** `addBusinessDays`,
`subtractBusinessDays` and the zoned pair all routed through `internal/advanceBusinessDays`,
which recursed once per calendar day; past roughly 6,000 business days it threw, the surrounding
`try`/`catch` swallowed it, and a valid request returned the invalid-input sentinel. Fixed here
as a bounded loop capped at 200,000 calendar days, per the coding standards' loop-style and
loop-exhaustion rules.

## What gmt provides (do not re-implement)

- `isValidDate` — local date validation
- `isValidTimeZone` — IANA zone validation for `BusinessCalendar.timeZone`
- `floorToZone` from CORE-5 — the bridge consumers use to reduce an instant to a local date
  before asking a business-day question. The business-day functions themselves are local-date
  in, local-date out, so they call nothing zone-aware.

## Verification

- `addBusinessDays` skips weekends and holidays in both directions
- `addBusinessDays(iso, 0, cal)` is identity, including when `iso` is not a business day
- `businessDaysBetween` with the documented exclusive/inclusive convention is asserted explicitly
- `rollDate` with `modifiedFollowing` on a month-end Friday holiday rolls **backward**, not forward
- `endOfMonth` maps any input to the last business day of its month
- `businessDaysBetween` is the inverse of `addBusinessDays`, and negates when the endpoints swap
- `mergeCalendars` excludes a date that is a holiday in either input
- Friday–Saturday weekend calendar behaves correctly
- `pnpm run validate` stays green
