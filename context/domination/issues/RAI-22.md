# RAI-22 — Rail: Rail legs, cross-border schedules and operating periods

**Scope:** Rail leg timing across timezone and national boundaries, and the day-bitmask operating periods timetable data uses.

## Gap

Rail has timezone problems the other modes do not. Several countries impose a single legal time across many geographic zones, so a train can travel 3000 km without a clock change. Cross-border services change legal time mid-journey at a point that is not a station. A timetable year that changes on one fixed date resets every schedule at once; that change date is an nth-weekday rule (CORE-54), and the guide shows it as "midnight ending the second Saturday in December" without owning it.

Timetable data — railML, HAFAS and their kin — encodes when a train runs as a **bitmask**: "a 1 is given for each day on which the train runs and a 0 for each day on which it does not", one character per day from a start date. It is the rail cousin of SSIM's days-of-operation string (AV-26).

([railML 2 `operatingPeriod@bitMask`](https://wiki2.railml.org/wiki/TT:operatingPeriod), [railML 3 `bitmaskValidity`](https://wiki3.railml.org/wiki/Generic:bitmaskValidity))

## Scope

- `packages/gmt/src/rail/calculate/railLeg.ts`:
  - `railLeg(departure: string, arrival: string, options: { departureZone: string, arrivalZone: string }): { duration: string, localDeparture: string, localArrival: string, offsetChange: string, dayOffset: number } | null` — `offsetChange` is the difference in UTC offset between the two ends; `dayOffset` is the local date difference.
- `packages/gmt/src/rail/calculate/crossBorderSchedule.ts`:
  - `crossBorderSchedule(departure: string, crossings: { at: string, toZone: string }[], startZone: string): { segments: { from: string, to: string, zone: string, localFrom: string, localTo: string }[] } | null` — Local times per segment across an arbitrary number of border crossings.
- `packages/gmt/src/rail/parse/operatingPeriod.ts`:
  - `parseOperatingBitmask(bitmask: string, fromDate: string): string[]` — The dates on which the train runs; the string's length defines the span (railML 3), or a `toDate` may be given and checked against it (railML 2).
  - `formatOperatingBitmask(dates: string[], range: { from: string, to: string }): string` — Inverse.
  - `bitmaskFromDaysOfOperation(days: number[], range, options?: { exceptions?: string[] }): string` — Weekly pattern plus exceptions to a bitmask, built on AV-26's `operatingDatesBetween` so rail and air agree about a weekday.

## Design notes

- **`offsetChange` replaces `zonesCrossed`.** The original spec counted "timezone transitions", which is not a well-defined quantity for a train: a service may pass through zones it never stops in, and offset changes are what actually affect the schedule. The offset difference between endpoints is unambiguous and is what a timetable needs.
- **`usesSingleTZ` is removed.** The original returned a boolean derived from a hardcoded three-country table (China, India, Spain). It is not GMT's fact to assert, it was incomplete, and it is already implied by the caller supplying the same zone for both ends. A country-to-zone table is exactly the bundled place data this epic declines to ship — see [../painpoints.md](../painpoints.md).
- **Crossings are caller-supplied**, because GMT does not know where a border is. It knows what happens to the clock when you tell it one was crossed.
- **A bitmask is dates, not a rule.** `parseOperatingBitmask` returns the dates and nothing else; whether the train runs is the mask's fact. railML 2 has both `startDate` and `endDate`, railML 3 only `fromDate` with the length defining the span; the parser accepts either and checks consistency.
- `dayOffset` matters: an overnight service departing 23:40 and arriving 06:15 arrives on a different local date, and schedules must show that.

## Corrections

- The timetable-year and milestone functions (`getTimetableYear`, `timetableMilestones`) encoded one jurisdiction's change date and its deadline calendar, each output citing a clause; both are removed. The change date is one `nthWeekdayOfMonth(year, 12, 6, 2)` call resolved with `resolveLocal`, shown in the rail guide as a number-labelled example ("midnight ending the second Saturday in December"); the deadlines counted back from it are the caller's `subtractDate` arithmetic.

## What gmt provides (do not re-implement)

- `transitTime` / `etaAtZone` from TRAN-8 — leg arithmetic
- `crossingTime` from TRAN-9 — the per-segment shape
- `operatingDatesBetween` from AV-26 — weekday patterns over a range
- `convertZonedToZoned` — timezone conversion
- `resolveLocal` from CORE-4 — local time resolution

## Verification

- A leg with the same zone at both ends returns `offsetChange: 'PT0S'`
- A Paris–Madrid leg returns a zero offset change despite the geographic distance
- A leg crossing from `Europe/Warsaw` to `Europe/Kyiv` returns a one-hour offset change
- An overnight leg returns `dayOffset: 1`
- `crossBorderSchedule` with two crossings returns three segments with correct local times
- A leg spanning a DST transition where only one endpoint's zone observes DST returns the correct duration and offset change
- `parseOperatingBitmask('1111100', '2026-06-01')` returns Monday–Friday of that week; a `toDate` inconsistent with the string length returns the sentinel
- `bitmaskFromDaysOfOperation([1, 3, 5], range)` round-trips through `parseOperatingBitmask` and agrees with AV-26's `operatingDatesBetween`
- `pnpm run validate` stays green
