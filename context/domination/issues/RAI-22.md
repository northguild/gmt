# RAI-22 — Rail: Rail legs, cross-border schedules, the timetable year and operating periods

**Scope:** Rail leg timing across timezone and national boundaries, the European working-timetable year with its allocation deadlines, and the day-bitmask operating periods European timetable data uses.

## Gap

Rail has timezone problems the other modes do not. Several countries impose a single legal time across many geographic zones, so a train can travel 3000 km without a clock change. Cross-border services change legal time mid-journey at a point that is not a station. And the European timetable year changes on a fixed date, which resets every schedule at once.

That date and the calendar of deadlines around it are law. Annex VII to Directive 2012/34/EU, as replaced by Delegated Decision (EU) 2017/2075: "The working timetable shall be established once per calendar year" (point 1); "The change of working timetable shall take place at midnight on the second Saturday in December" and any post-winter adjustment "at midnight on the second Saturday in June" (point 2); the deadline for capacity requests "shall be no more than 12 months in advance of the change of the working timetable" (point 3); provisional international paths "No later than 11 months before" (point 4); the draft timetable "at the latest four months after the deadline referred to in point (3)" (point 5); the final update "no later than one month before the change" (point 6); major temporary capacity restrictions published "at least 24 months" and "at least 12 months before the change" (point 8); coordination "no later than 18 months before" for restrictions over 50 % of traffic for more than 30 days and "no later than 13 months and 15 days" for the next tier (point 11); minor restrictions known "no later than 6 months and 15 days before" and communicated "at least four months before" (point 12).

European timetable data — railML, HAFAS, the TSI TAF/TAP exchanges — encodes when a train runs as a **bitmask**: "a 1 is given for each day on which the train runs and a 0 for each day on which it does not", one character per day from a start date. It is the rail cousin of SSIM's days-of-operation string (AV-26).

([Commission Delegated Decision (EU) 2017/2075, Annex, points 1–12](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32017D2075), [railML 2 `operatingPeriod@bitMask`](https://wiki2.railml.org/wiki/TT:operatingPeriod), [railML 3 `bitmaskValidity`](https://wiki3.railml.org/wiki/Generic:bitmaskValidity))

## Scope

- `packages/gmt/src/rail/calculate/railLeg.ts`:
  - `railLeg(departure: string, arrival: string, options: { departureZone: string, arrivalZone: string }): { duration: string, localDeparture: string, localArrival: string, offsetChange: string, dayOffset: number } | null` — `offsetChange` is the difference in UTC offset between the two ends; `dayOffset` is the local date difference.
- `packages/gmt/src/rail/calculate/crossBorderSchedule.ts`:
  - `crossBorderSchedule(departure: string, crossings: { at: string, toZone: string }[], startZone: string): { segments: { from: string, to: string, zone: string, localFrom: string, localTo: string }[] } | null` — Local times per segment across an arbitrary number of border crossings.
- `packages/gmt/src/rail/get/timetableYear.ts`:
  - `getTimetableYear(isoString: string): { year: number, startsAt: string, endsAt: string, juneAdjustmentAt: string }` — The European timetable period containing a date: from midnight at the end of the second Saturday in December to the same instant a year later, with the June adjustment date.
  - `timetableMilestones(timetableYear: number): { requestsDeadlineLatest: string, provisionalInternationalPathsBy: string, draftTimetableBy: string, finalUpdateBy: string, majorRestrictionsFirstPublicationBy: string, majorRestrictionsSecondPublicationBy: string, coordinationOver50PercentBy: string, coordinationOver30PercentBy: string, minorRestrictionsKnownBy: string, minorRestrictionsCommunicatedBy: string }` — Every Annex VII deadline as a date, each citing its point. Dates are days before the change date; "months" are calendar months (Temporal, constrained), and the JSDoc says the Directive gives no other rule.
- `packages/gmt/src/rail/parse/operatingPeriod.ts`:
  - `parseOperatingBitmask(bitmask: string, fromDate: string): string[]` — The dates on which the train runs; the string's length defines the span (railML 3), or a `toDate` may be given and checked against it (railML 2).
  - `formatOperatingBitmask(dates: string[], range: { from: string, to: string }): string` — Inverse.
  - `bitmaskFromDaysOfOperation(days: number[], range, options?: { exceptions?: string[] }): string` — Weekly pattern plus exceptions to a bitmask, built on AV-26's `operatingDatesBetween` so rail and air agree about a weekday.

## Design notes

- **`offsetChange` replaces `zonesCrossed`.** The original spec counted "timezone transitions", which is not a well-defined quantity for a train: a service may pass through zones it never stops in, and offset changes are what actually affect the schedule. The offset difference between endpoints is unambiguous and is what a timetable needs.
- **`usesSingleTZ` is removed.** The original returned a boolean derived from a hardcoded three-country table (China, India, Spain). It is not GMT's fact to assert, it was incomplete, and it is already implied by the caller supplying the same zone for both ends. A country-to-zone table is exactly the bundled place data this epic declines to ship — see [../painpoints.md](../painpoints.md).
- **Crossings are caller-supplied**, because GMT does not know where a border is. It knows what happens to the clock when you tell it one was crossed.
- **The change is at midnight ending the second Saturday**, so the new timetable's first day is the second Sunday in December — the Directive's wording is kept in the JSDoc so nobody "fixes" it to Sunday midnight. Infrastructure managers "may agree on different dates"; the function returns the default and takes an override.
- **Milestones are counted back from the change date in the units the Annex uses** — months and "months and 15 days" — with Temporal's constrain rule for month-ends; the Annex gives no business-day rule, so none is applied, and the JSDoc says so.
- **A bitmask is dates, not a rule.** `parseOperatingBitmask` returns the dates and nothing else; whether the train runs is the mask's fact. railML 2 has both `startDate` and `endDate`, railML 3 only `fromDate` with the length defining the span; the parser accepts either and checks consistency.
- `dayOffset` matters: an overnight service departing 23:40 and arriving 06:15 arrives on a different local date, and schedules must show that.

## What gmt provides (do not re-implement)

- `transitTime` / `etaAtZone` from TRAN-8 — leg arithmetic
- `crossingTime` from TRAN-9 — the per-segment shape
- `operatingDatesBetween` from AV-26 — weekday patterns over a range
- `nthWeekdayOfMonth` from CORE-54 — the second Saturday in December and June
- `convertZonedToZoned` — timezone conversion
- `resolveLocal` from CORE-4 — local time resolution
- `subtractDate` — milestone arithmetic

## Verification

- A leg with the same zone at both ends returns `offsetChange: 'PT0S'`
- A Paris–Madrid leg returns a zero offset change despite the geographic distance
- A leg crossing from `Europe/Warsaw` to `Europe/Kyiv` returns a one-hour offset change
- An overnight leg returns `dayOffset: 1`
- `crossBorderSchedule` with two crossings returns three segments with correct local times
- A leg spanning a DST transition where only one endpoint's zone observes DST returns the correct duration and offset change
- `getTimetableYear('2026-03-01')` returns a period starting at the end of Saturday 13 December 2025 (`startsAt` = `2025-12-14T00:00` in the caller's zone) and ending at the end of Saturday 12 December 2026, with `juneAdjustmentAt` the end of Saturday 13 June 2026
- `timetableMilestones(2027)` returns `requestsDeadlineLatest` 12 months before the December 2026 change, `provisionalInternationalPathsBy` 11 months before, `draftTimetableBy` 4 months after the request deadline, `finalUpdateBy` 1 month before, `coordinationOver30PercentBy` 13 months and 15 days before — each asserted against the Annex point it cites
- `parseOperatingBitmask('1111100', '2026-06-01')` returns Monday–Friday of that week; a `toDate` inconsistent with the string length returns the sentinel
- `bitmaskFromDaysOfOperation([1, 3, 5], range)` round-trips through `parseOperatingBitmask` and agrees with AV-26's `operatingDatesBetween`
- `pnpm run validate` stays green
