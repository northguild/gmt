# RAI-22 — Rail: Rail legs, cross-border schedules and the timetable year

**Scope:** Rail leg timing across timezone and national boundaries, and the European timetable year.

## Gap

Rail has timezone problems the other modes do not. Several countries impose a single legal time across many geographic zones, so a train can travel 3000 km without a clock change. Cross-border services change legal time mid-journey at a point that is not a station. And the European timetable year changes on a fixed date, which resets every schedule at once.

## Scope

- `packages/gmt/src/rail/calculate/railLeg.ts`:
  - `railLeg(departure: string, arrival: string, options: { departureZone: string, arrivalZone: string }): { duration: string, localDeparture: string, localArrival: string, offsetChange: string, dayOffset: number } | null` — `offsetChange` is the difference in UTC offset between the two ends; `dayOffset` is the local date difference.
- `packages/gmt/src/rail/calculate/crossBorderSchedule.ts`:
  - `crossBorderSchedule(departure: string, crossings: { at: string, toZone: string }[], startZone: string): { segments: { from: string, to: string, zone: string, localFrom: string, localTo: string }[] } | null` — Local times per segment across an arbitrary number of border crossings.
- `packages/gmt/src/rail/get/timetableYear.ts`:
  - `getTimetableYear(isoString: string): { year: number, startsAt: string, endsAt: string }` — The European timetable period containing a date. Periods change on the **second Sunday in December**.

## Design notes

- **`offsetChange` replaces `zonesCrossed`.** The original spec counted "timezone transitions", which is not a well-defined quantity for a train: a service may pass through zones it never stops in, and offset changes are what actually affect the schedule. The offset difference between endpoints is unambiguous and is what a timetable needs.
- **`usesSingleTZ` is removed.** The original returned a boolean derived from a hardcoded three-country table (China, India, Spain). It is not GMT's fact to assert, it was incomplete, and it is already implied by the caller supplying the same zone for both ends. A country-to-zone table is exactly the bundled place data this epic declines to ship — see [../painpoints.md](../painpoints.md).
- **Crossings are caller-supplied**, because GMT does not know where a border is. It knows what happens to the clock when you tell it one was crossed.
- `dayOffset` matters: an overnight service departing 23:40 and arriving 06:15 arrives on a different local date, and schedules must show that.

## What gmt provides (do not re-implement)

- `transitTime` / `etaAtZone` from TRAN-8 — leg arithmetic
- `crossingTime` from TRAN-9 — the per-segment shape
- `convertZonedToZoned` — timezone conversion
- `resolveLocal` from CORE-4 — local time resolution

## Verification

- A leg with the same zone at both ends returns `offsetChange: 'PT0S'`
- A Paris–Madrid leg returns a zero offset change despite the geographic distance
- A leg crossing from `Europe/Warsaw` to `Europe/Kyiv` returns a one-hour offset change
- An overnight leg returns `dayOffset: 1`
- `crossBorderSchedule` with two crossings returns three segments with correct local times
- A leg spanning a DST transition where only one endpoint's zone observes DST returns the correct duration and offset change
- `getTimetableYear` returns a period starting on the second Sunday in December
- `pnpm run validate` stays green
