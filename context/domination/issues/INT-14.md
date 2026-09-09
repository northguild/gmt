# INT-14 — Intermodal: Bill of lading timestamps + multimodal ETA

**Scope:** Bill of lading date semantics and end-to-end multimodal ETA.

## Gap

A bill of lading carries several dates with different legal meanings and different precisions — the shipped-on-board date is the one that matters for a letter of credit, and it is a date, not a timestamp. Meanwhile an end-to-end ETA has to compose legs with dwell at every handoff.

## Scope

- `packages/gmt/src/intermodal/format/bolTimestamp.ts`:
  - `bolTimestamp(value: string, event: 'issue' | 'onBoard' | 'received' | 'shippedOnBoard', options?: { timeZone?: string }): string` — Renders a B/L date at the precision the event calls for.
- `packages/gmt/src/intermodal/calculate/multimodalETA.ts`:
  - `multimodalETA(legs: Leg[], options?: { dwell?: string[] }): { eta: string, totalLegs: number, totalTransit: string, totalDwell: string } | null` — End-to-end ETA with dwell accounted separately from transit.

## Bill of lading date types

| Event | Meaning | Precision |
| --- | --- | --- |
| `issue` | B/L issued at origin | Date |
| `received` | Cargo received into carrier's care | Date, local to origin |
| `onBoard` / `shippedOnBoard` | Cargo loaded aboard the vessel | Date; the letter-of-credit-relevant date |

## Design notes

- **Date, not timestamp.** These are contractual dates in a jurisdiction's local calendar. Rendering an instant as a B/L date requires the origin timezone, otherwise a 21:00 local loading in Shanghai is dated the following day. `timeZone` is required for any local-dated event.
- `multimodalETA` reports transit and dwell separately rather than summing them into one opaque number, because the two have different reliability and consumers forecast them differently.
- Dwell is caller-supplied. It is not estimated — see INT-11's Corrections for why estimating dwell is out of scope.

## Corrections

The original INT-2 specced `multimodalETA(legs, { portDwellDays, customsDays })`, which folded an invented customs-processing estimate into the ETA. `customsDays` is removed for the same reason `customsClearance` was (INT-13). Dwell is now an explicit per-handoff input, and the function no longer pretends to know how long customs takes.

## What gmt provides (do not re-implement)

- `scheduleDelivery` from TRAN-9 — multi-leg scheduling
- `containerLeg` from INT-11 — single-leg arrival
- `sumIntervals` from CORE-6 — dwell totals
- `floorToZone` from CORE-5 — local date derivation for B/L dates

## Verification

- `bolTimestamp(..., 'shippedOnBoard')` returns a date with no time component
- A 21:00 local loading returns the local date, not the UTC date
- `multimodalETA` totals equal the sum of leg durations plus supplied dwell
- Transit and dwell are reported separately and sum to the end-to-end elapsed time
- Empty legs array returns `{ eta: '', totalLegs: 0, totalTransit: 'PT0S', totalDwell: 'PT0S' }`
- Missing `timeZone` for a local-dated event returns the sentinel
- `pnpm run validate` stays green
