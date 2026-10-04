# INT-14 — Intermodal: Bill of lading timestamps + multimodal ETA

**Scope:** Bill of lading date semantics and end-to-end multimodal ETA.

## Gap

A bill of lading carries several dates with different meanings — a documentary credit reads the date of shipment from them — and every one of them is a local calendar date, not a timestamp. Meanwhile an end-to-end ETA has to compose legs with dwell at every handoff.

## Scope

- `packages/gmt/src/intermodal/format/bolTimestamp.ts`:
  - `bolTimestamp(value: string, event: BillOfLadingEvent, options: { timeZone: string }): string` — Renders a B/L date as the local calendar date of the place the event happened.
  - `BillOfLadingEvent` is `'issue' | 'received' | 'onBoard' | 'shippedOnBoard'`.
- `packages/gmt/src/intermodal/calculate/multimodalETA.ts`:
  - `multimodalETA(legs: Leg[], options?: { startTimeZone?: string }): { eta: string, totalLegs: number, totalTransit: string, totalDwell: string } | null` — End-to-end ETA with dwell accounted separately from transit. `Leg` and the options are TRAN-9's `scheduleDelivery` types.
- Docs site: the guide `guides/industries/intermodal-bill-of-lading-and-eta.mdx`, the scenarios `bill-of-lading-dated-a-day-late` and `eta-that-forgot-the-sailing`, and a `## B/L dates and multimodal ETA` section on `mistakes/intermodal.mdx`.

## Bill of lading date types

| Event | Meaning | Precision | DCSA field |
| --- | --- | --- | --- |
| `issue` | B/L issued | Date, local to the place of issue | `issueDate` |
| `received` | The last container is in the terminal, cleared for the intended vessel | Date, local to that terminal (normally the port of loading) | `receivedForShipmentDate` |
| `onBoard` | On-board notation on a received-for-shipment B/L | Date, local to the port of loading | — (see below) |
| `shippedOnBoard` | The last container loaded aboard the vessel | Date, local to the port of loading | `shippedOnBoardDate` |

`onBoard` has no DCSA field. The on-board notation, and which date is the date of shipment, come from UCP 600 art. 20(a)(ii): "The date of issuance of the bill of lading will be deemed to be the date of shipment unless the bill of lading contains an on board notation indicating the date of shipment, in which case the date stated in the on board notation will be deemed to be the date of shipment." **Primary text not reached:** UCP 600 is an ICC publication behind a paywall, and this wording is quoted from ICC library excerpts. It is marked here and asserted nowhere downstream; `bolTimestamp` does not implement the rule, it only dates whichever event the caller names.

DCSA Bill of Lading 3.0 (eBL API 3.0.4, `TransportDocument` schema, [dcsaorg/DCSA-OpenAPI `ebl/v3/EBL_v3.0.4.yaml`](https://github.com/dcsaorg/DCSA-OpenAPI/blob/master/ebl/v3/EBL_v3.0.4.yaml)) types all three fields `type: string, format: date`, and describes `issueDate` as "Local date when the transport document has been issued".

## Design notes

- **Date, not timestamp.** These are contractual dates in a place's local calendar. Rendering an instant as a B/L date requires that place's time zone, otherwise the UTC date is wrong for part of every day: a 21:00 local loading in New York (01:00Z) is dated the following day, and a 07:00 local loading in Shanghai (23:00Z) the day before. `timeZone` is required for every event.
- **Every event is local-dated, so `event` does not change the rendering (decided).** All four events render as the same `YYYY-MM-DD`. `event` is required and checked (an unknown value returns `""`) so the call site names the field it fills; the zone is what differs by event: the place of issue for `issue`, the terminal at the port of loading for the other three. The JSDoc says plainly that all four render the same way.
- **`timeZone` is always required (decided).** There is no UTC default and no system zone. Omitting it, or omitting `options`, returns `""`. The options argument is typed as required.
- **Only the instant is read (decided).** `value` is anything `isValidInstant` accepts; a bracketed zone in it is not the zone the date is read in, as `floorToZone` and `etaAtZone` read theirs. A zoneless wall time or a bare date names no moment and returns `""`, so no local-to-instant resolution arises and no disambiguation policy applies.
- **`multimodalETA` runs on `scheduleDelivery` (decided).** It takes TRAN-9's `Leg[]` and `startTimeZone`, and every scheduling rule (missed connection, wall-time departures, repeated hours at a hub) is that function's. Each leg's fields are read once into a plain copy, so the totals always agree with the schedule.
- **`totalDwell` is the time actually spent at the handoffs (decided).** It is each leg's departure minus the previous leg's arrival, summed: TRAN-8's `dwellTime` meaning of dwell. When every leg chains from its predecessor it equals the sum of the `dwellAfter` values; a wait for a scheduled departure is dwell too. So `totalTransit + totalDwell` is always the elapsed time from the first departure to the ETA.
- **The last leg's `dwellAfter` is not dwell (decided).** No handoff follows it, so it moves nothing, as in `scheduleDelivery`; it is still validated as a duration.
- Both totals are ISO 8601 durations of exact elapsed time with hours as the largest unit, as `crossingTime` and `dwellTime` report theirs.
- `multimodalETA` reports transit and dwell separately rather than summing them into one opaque number, because the two have different reliability and consumers forecast them differently. The opaque number is what schedules publish: DCSA Commercial Schedules 1.0.4 gives a route's `transitTime` as one integer of days that "includes stop-over time during transhipments and waiting time at connection points" (`PointToPoint.transitTime`, [`cs/v1/CS_v1.0.4.yaml`](https://github.com/dcsaorg/DCSA-OpenAPI/blob/master/cs/v1/CS_v1.0.4.yaml)). Recorded in `painpoints.md`.
- Dwell is caller-supplied. It is not estimated — see TRAN-8's Corrections for why free time is a contract term rather than a port fact, and TRAN-10's Corrections for why estimating processing time is out of scope.

## Corrections

The original INT-2 specced `multimodalETA(legs, { portDwellDays, customsDays })`, which folded an invented customs-processing estimate into the ETA. `customsDays` is removed for the same reason `customsClearance` was (recorded under TRAN-10). Dwell is now an explicit per-handoff input, and the function no longer pretends to know how long customs takes.

Corrected while building the story (2026-10-04):

- **`options.dwell: string[]` is removed.** TRAN-9's `Leg` already carries `dwellAfter`, the per-handoff dwell, and `scheduleDelivery` reads it; a second array for the same fact would need a rule for when the two disagree. `multimodalETA` takes `scheduleDelivery`'s legs and options instead.
- **B/L dates do not differ in precision.** The Gap said they did. DCSA Bill of Lading 3.0 types all three as `format: date`, so `bolTimestamp` returns a date for every event.
- **The UTC example was the wrong way round.** The Design notes said a 21:00 loading in Shanghai would be dated the following day in UTC. Shanghai is ahead of UTC, so 21:00 there is 13:00Z the same day; the UTC date runs a day late west of Greenwich in the evening, and a day early east of it in the morning.
- **`timeZone` is not optional.** The spec typed `options?: { timeZone?: string }` but required the zone for every local-dated event, and every event is local-dated.

### Fixed in this story, found by its standards review

GMT's object check was `typeof value === "object"`, so every function returned its sentinel for an options bag, a property bag or a record written as a function. ECMA-262's GetOptionsObject, and Temporal's property-bag readers, accept any Object, and a function is one. `internal/isObject.ts` now accepts functions and is the one check everywhere, `relativeTo` property bags included (`patch` changeset `options-bags-may-be-functions`; `test/optionsObject.test.ts` and `test/functionObjects.test.ts`). The owner chose to fix the whole class here (Core Rule 12).

## What gmt provides (do not re-implement)

- `scheduleDelivery` and the `Leg` type from TRAN-9 — multi-leg scheduling, the missed-connection rule and the ETA
- `transitTime` / `etaAtZone` from TRAN-8 — the duration grammar and the local ETA, through `scheduleDelivery`
- `isValidInstant` from CORE-1 — the instant gate, with the minute-rounded offset rule

## Verification

- `bolTimestamp(..., 'shippedOnBoard')` returns a date with no time component
- A 21:00 local loading west of Greenwich, and a 07:00 local loading east of it, return the local date, not the UTC date
- All four events render the same date; an unknown event returns the sentinel
- Missing `timeZone` returns the sentinel
- `multimodalETA` totals equal the sum of leg durations plus supplied dwell when every leg chains
- Transit and dwell are reported separately and sum to the end-to-end elapsed time, including a wait for a scheduled departure
- Empty legs array returns `{ eta: '', totalLegs: 0, totalTransit: 'PT0S', totalDwell: 'PT0S' }`
- `pnpm run validate` stays green
