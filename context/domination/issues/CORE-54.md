# CORE-54 — Core: Holiday rule engine

**Scope:** Turning the rules that define holidays — "third Monday in January", "Good Friday", "25 December, observed on the Monday if it falls on a Sunday" — into dates and business calendars, without GMT owning any holiday list.

## Gap

CORE-7 takes holidays as an enumerated list of dates, which is the right contract for a business calendar and the wrong shape for where holidays come from. Almost every legal or market holiday is a *rule*, and the rules have exactly three forms: a fixed month and day with an observance shift, an ordinal weekday of a month, or an offset from Easter. Five stories in this epic need one of those forms as a primitive in its own right — IMM dates are the third Wednesday (FIN-44), crypto expiries the last Friday (FIN-45), the IATA season boundary the last Sunday in March (AV-26), FIN-41's reference calendars are lists of rules with provenance, and laytime SHEX (MAR-19) needs a port's holidays for a year that may not be tabulated yet.

The observance shift is where implementations diverge. One policy moves a Saturday holiday to the preceding Friday and a Sunday holiday to the following Monday; another substitutes the next working day; another shifts Sunday holidays only. None is a default, so the shift is a parameter.

([ECB TARGET closing days](https://www.ecb.europa.eu/paym/target/target2/profuse/calendar/html/index.en.html) as a worked rule set, [Meeus, *Astronomical Algorithms*, ch. 8, Date of Easter](https://www.willbell.com/math/mc1.htm))

## Scope

- `packages/gmt/src/calendar/rules/nthWeekdayOfMonth.ts`:
  - `nthWeekdayOfMonth(year: number, month: number, weekday: number, n: 1 | 2 | 3 | 4 | 5 | 'last'): string` — ISO weekday numbers; the sentinel when the fifth occurrence does not exist.
- `packages/gmt/src/calendar/rules/easterSunday.ts`:
  - `easterSunday(year: number, options?: { calendar?: 'gregorian' | 'julian' }): string` — Gregorian computus by default; the Julian (Orthodox) date is returned as a Gregorian calendar date.
- `packages/gmt/src/calendar/rules/observedDate.ts`:
  - `observedDate(isoDate: string, policy: ObservancePolicy, calendar?: BusinessCalendar): string` — Where a holiday falling on a non-working day is observed. `ObservancePolicy` is `{ saturday: 'none' | 'previousFriday' | 'nextMonday' | 'nextWorkingDay', sunday: 'none' | 'nextMonday' | 'nextWorkingDay' | 'nextTuesday' }`; `nextWorkingDay` needs the calendar so two shifted holidays do not land on the same day.
- `packages/gmt/src/calendar/rules/holidayDates.ts`:
  - `holidayDates(rule: HolidayRule, year: number, options?: { calendar?: BusinessCalendar }): string[]` — All dates a rule produces in a year (usually one).
  - `HolidayRule` is `{ name: string } & ({ kind: 'fixed', month: number, day: number, observed?: ObservancePolicy } | { kind: 'nthWeekday', month: number, weekday: number, n: 1 | 2 | 3 | 4 | 5 | 'last' } | { kind: 'easterRelative', offsetDays: number, calendar?: 'gregorian' | 'julian' } | { kind: 'dates', dates: string[] })`.
- `packages/gmt/src/calendar/rules/buildBusinessCalendar.ts`:
  - `buildBusinessCalendar(spec: { timeZone: string, weekend: number[], rules: HolidayRule[], years: { from: number, to: number } }): BusinessCalendar | null` — Expands rules into CORE-7's enumerated shape for a year range, so every consumer keeps working against the existing type.

## Design notes

- **Rules are logic; rule sets are data — and no national rule set ships.** This story ships the three rule forms and the expansion. FIN-41's opt-in `finance/data` subpath carries exchange and payment-system calendars only, each with its source and revision. The TARGET closing days are the worked example in the JSDoc, cited to the operator, not an exported constant.
- **Observance has no default.** `fixed` rules without `observed` fall on the day they fall; a caller who wants a Saturday→Friday, Sunday→Monday policy says so. No policy is a default, because defaulting to one convention would silently make every other calendar wrong.
- **Easter is a formula with two calendars.** The Gregorian computus (Meeus ch. 8, Oudin's algorithm) and the Julian computus give different Sundays most years; some markets and public calendars key on the Julian one. The function is exact for every year in Temporal's range and needs no table.
- **`nthWeekdayOfMonth` is the primitive FIN-44, FIN-45 and AV-26 already re-derive**; after this story they call it. The existing `plain/` helpers `getWeekOfMonth`, `nextWeekday` and `previousWeekday` are the building blocks, not replacements.
- Expanding a `nextWorkingDay` observance is order-dependent (Christmas and Boxing Day both shifting in 2021), so `buildBusinessCalendar` expands rules in list order and passes the calendar-so-far to each shift. Documented.

## What gmt provides (do not re-implement)

- `BusinessCalendar` / `isBusinessDay` / `nextBusinessDay` from CORE-7 — the target shape and the working-day walk for `nextWorkingDay`
- `getWeekOfMonth` / `nextWeekday` / `previousWeekday` / `getDayOfWeek` from `plain/` — weekday arithmetic
- `isValidDate` — rule output validation

## Verification

- `nthWeekdayOfMonth(2026, 1, 1, 3)` returns the third Monday of January 2026; `n: 'last'` for May returns the last Monday; a fifth Friday in a month with four returns the sentinel
- `easterSunday(2024)` returns `'2024-03-31'`; `easterSunday(2024, { calendar: 'julian' })` returns `'2024-05-05'`; the two coincide in 2025 (`'2025-04-20'`), asserted
- `observedDate('2027-12-25', { saturday: 'previousFriday', sunday: 'nextMonday' })` returns `'2027-12-24'`; `'2022-12-25'` (a Sunday) returns `'2022-12-26'`
- With `nextWorkingDay` and a calendar already containing 26 December, Christmas 2021 (a Saturday) is observed on Tuesday 28 December, asserted: two rules shifting into each other
- `holidayDates` for `{ kind: 'easterRelative', offsetDays: -2 }` in 2024 returns Good Friday `'2024-03-29'`; `offsetDays: 1` returns Easter Monday
- `buildBusinessCalendar` from an eleven-rule set mixing fixed-with-observance, nth-weekday and Easter-relative rules for 2026 produces a calendar on which `isBusinessDay` is false on every listed date and their observed shifts, and true on the surrounding days
- `buildBusinessCalendar` from the six TARGET closing-day rules matches the ECB's published 2026 list
- Invalid month, weekday or year range returns the sentinel
- `pnpm run validate` stays green
