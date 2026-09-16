---
"@northguild/gmt": minor
---

Add the business calendar engine: holiday calendars, calendar composition and roll conventions (Story CORE-7).

`BusinessCalendar` is `{ weekend: number[], holidays: string[], timeZone: string }`. The weekend is explicit ISO weekday numbers because Saturday–Sunday is not universal — much of the Middle East is Friday–Saturday, and some markets keep a one-day weekend. Holidays are caller-supplied: GMT bundles no holiday table on the default import path, because holiday data is jurisdictional and changes annually, sometimes with days of notice.

New in `calendar/business/`:

```ts
businessDaysBetween("2024-07-01", "2024-07-05", usCalendar); // 3 — start exclusive, end inclusive
nextBusinessDay("2024-07-03", usCalendar); // "2024-07-05" — strictly after, skipping 4 July
previousBusinessDay("2024-07-05", usCalendar); // "2024-07-03"
rollDate("2024-05-31", "modifiedFollowing", usCalendar); // "2024-05-30" — forward would leave May
mergeCalendars([usCalendar, ukCalendar]); // working days both jurisdictions share
```

`rollDate` implements the six conventions — `following`, `modifiedFollowing`, `preceding`, `modifiedPreceding`, `endOfMonth` and `none`. `mergeCalendars` unions weekend rules and holidays, so a date survives only if it is a working day in every input: the two-currency intersection FX settlement needs, and the two-port one an intermodal move needs.

`isBusinessDay`, `addBusinessDays` and `subtractBusinessDays` take an optional `BusinessCalendar` as a new trailing argument. Omitting it keeps their existing Monday–Friday, no-holiday behaviour exactly, so no shipped call changes. All three are re-exported from `calendar/business` alongside the new functions.

`isValidBusinessCalendar` and `isValidRollConvention` narrow a candidate, telling a misconfigured calendar or contract term apart from bad date input when a function returns its sentinel.

Fixes a defect in `addBusinessDays` / `subtractBusinessDays` / `addZonedBusinessDays` / `subtractZonedBusinessDays`: the shared walker recursed once per calendar day, so an amount above roughly 6,000 business days overflowed the stack and returned the invalid-input sentinel for a valid request — `addBusinessDays("2024-01-01", 10000)` returned `""` instead of `"2062-05-01"`. The walk is now a bounded loop, capped at 200,000 calendar days (about 547 years), returning the sentinel only when that cap is reached.
