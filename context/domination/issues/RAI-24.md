# RAI-24 — Rail: GTFS service days and after-midnight times

**Scope:** The GTFS time model, which is the dominant public-transport data format and permits times beyond 24:00:00.

## Gap

GTFS was missing from the epic entirely, and it contains the highest-frequency temporal bug class in transit software.

**`stop_times.arrival_time` and `departure_time` may exceed 24:00:00.** A value of `25:35:00` means 01:35 the following calendar day, expressed in the local time of the day the trip **began**. Times belong to a *service day*, not a calendar date, because agencies running past midnight group those trips with the previous day's service.

The consequence is a query bug that most implementations have. To find trips between 00:00 and 01:00 on 30 January you must search `00:00:00–01:00:00` for service date `20140130` **and** `24:00:00–25:00:00` for service date `20140129`. Correct consumers handle ranges as wide as `00:00–27:00`.

Worse, GTFS times are measured from **"noon minus 12 hours"** rather than midnight — which equals midnight except on days when DST changes. The definition exists precisely so that most feeds stay DST-correct without modification.

Sources: [MobilityData stop_times reference](https://github.com/MobilityData/gtfs-reference/blob/master/en/stop_times.md), [transit-developers on service days](https://groups.google.com/g/transit-developers/c/ZkfnuNv1gho), [GTFS reference](https://gtfs.org/documentation/schedule/reference/).

## Scope

- `packages/gmt/src/rail/parse/gtfsTime.ts`:
  - `parseGtfsTime(value: string): { seconds: number, dayOverflow: number } | null` — `'25:35:00'` yields 5700 seconds past midnight with `dayOverflow: 1`. Values below `24:00:00` yield `dayOverflow: 0`.
  - `formatGtfsTime(seconds: number, dayOverflow?: number): string` — Inverse. Emits `25:35:00`, not `01:35:00`.
- `packages/gmt/src/rail/convert/gtfsToInstant.ts`:
  - `gtfsToInstant(serviceDate: string, gtfsTime: string, timeZone: string): string` — Resolves a service date and GTFS time to an instant, anchored at noon minus 12 hours on the service date.
- `packages/gmt/src/rail/calculate/serviceDateRange.ts`:
  - `serviceDatesForWindow(window: Interval, timeZone: string, options?: { maxOverflowHours?: number }): { serviceDate: string, from: string, to: string }[]` — The service dates and time ranges to query for a wall-clock window. Defaults to 27 hours of overflow.

## Design notes

- **The anchor is noon minus 12 hours, not midnight.** On a spring-forward day, local midnight may not exist, and on a fall-back day it occurs twice; noon always exists exactly once. Anchoring at noon and subtracting 12 hours sidesteps both, which is why the specification defines it that way. Implementing it as "local midnight" reintroduces the DST bug the spec was written to avoid.
- **`serviceDatesForWindow` is the function that prevents the query bug.** Consumers reliably get this wrong by hand; providing it is the point of the story.
- `dayOverflow` is returned separately rather than folded into the time, so round-tripping preserves the original `25:35:00` representation. Normalising to `01:35:00` loses the service-day association, which is the whole meaning of the field.
- `calendar.txt` and `calendar_dates.txt` service selection is data modelling, not time math, and stays with the consumer. This story supplies the temporal primitives those lookups need.

## What gmt provides (do not re-implement)

- `resolveLocal` / `classifyLocal` from CORE-4 — resolving the noon anchor
- `floorToZone` from CORE-5 — local day boundaries
- `intervalsOverlap` from CORE-6 — window matching

## Verification

- `parseGtfsTime('25:35:00')` returns `{ seconds: 5700, dayOverflow: 1 }`
- `parseGtfsTime('14:30:00')` returns `dayOverflow: 0`
- Round-trip: `formatGtfsTime(parseGtfsTime('25:35:00'))` returns `'25:35:00'`, not `'01:35:00'`
- `gtfsToInstant` on a spring-forward service date resolves via the noon anchor and does not return the sentinel despite local midnight not existing
- `gtfsToInstant` on a fall-back service date resolves unambiguously
- A `27:00:00` value resolves to 03:00 two local days later where the service day began
- `serviceDatesForWindow` for 00:00–01:00 on a given date returns **two** entries: that date at `00:00–01:00` and the prior date at `24:00–25:00`
- Malformed values and negative times return the sentinel
- `pnpm run validate` stays green
