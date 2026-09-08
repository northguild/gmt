# INT-2 — Intermodal: Bill of lading + multimodal ETA — `bolTimestamp` + `multimodalETA`

**Scope:** Bill of lading timestamp handling and end-to-end multimodal ETA computation.

## Gap

Bill of lading (B/L) documents have specific timestamp requirements. Intermodal shipments involve multiple modes and require end-to-end ETA computation that accounts for mode transitions and dwell times.

## Scope

- `packages/gmt/src/intermodal/bill-of-lading.ts`:
  - `bolTimestamp(bolDate: string, format: 'issue' | 'onBoard' | 'received'): string` — Formats a bill of lading timestamp for the given event type.
  - `multimodalETA(legs: Leg[], options?: { portDwellDays?: number, customsDays?: number }): { eta: string, totalLegs: number, totalDwell: string }` — Computes end-to-end ETA for a multimodal shipment. Includes estimated dwell at ports and customs processing time.

## Bill of lading timestamp types

| Event | Meaning | Format |
|-------|---------|--------|
| `issue` | B/L issued at origin | Date only |
| `onBoard` | Cargo loaded on first vessel | Date + time (UTC) |
| `received` | Empty container received at origin | Date + time (local) |

## What gmt provides (do not re-implement)

- `containerLeg` from INT-1 — base leg computation
- `scheduleDelivery` from TRAN-2 — multi-leg scheduling
- `portDwell` / `customsClearance` from INT-1 — dwell estimates

## Verification

- `bolTimestamp` returns correct format for each event type
- `multimodalETA` correctly sums all legs plus dwell/customs time
- Empty legs array: returns `{ eta: '', totalLegs: 0, totalDwell: 'PT0S' }`
- `pnpm run validate` stays green
