# IOT-32 — IoT: Ingest time model

**Scope:** Separating when an observation happened from when it arrived, and classifying late data.

## Gap

Devices buffer while offline and upload in bulk when connectivity returns. A single timestamp field cannot represent that: it either records when the reading was taken, in which case the pipeline cannot tell fresh data from a three-day backfill, or it records when the data arrived, in which case the reading is timestamped wrongly.

Every mature telemetry system separates the two, and GMT has no primitive for it. Downstream, "is this observation late" is a question about a watermark, which is itself a temporal calculation nothing in the library supports.

## Scope

- `packages/gmt/src/iot/get/observation.ts`:
  - `observation(value: { observedAt: string, receivedAt: string }): { observedAt: string, receivedAt: string, lagMs: number, backfilled: boolean } | null` — The two-field pair with derived lag. `backfilled` is `true` beyond a documented threshold.
- `packages/gmt/src/iot/calculate/watermark.ts`:
  - `watermark(observations: { observedAt: string }[], options: { allowedLatenessMs: number }): string | null` — The watermark instant: everything at or before it is considered complete.
  - `classifyArrival(observedAt: string, watermark: string): 'onTime' | 'late' | 'future'` — `'future'` catches observations timestamped ahead of the watermark, which indicates a device clock error rather than early data.
- `packages/gmt/src/iot/calculate/reorderWindow.ts`:
  - `maxOutOfOrderness(observations: { observedAt: string, receivedAt: string }[]): number` — Largest observed reordering, in milliseconds, for sizing `allowedLatenessMs` empirically.

## Design notes

- **`observedAt` and `receivedAt` are both required.** Deriving one from the other is what this story exists to prevent. `lagMs` is derived and may legitimately be large.
- **`'future'` is a distinct classification, not a variety of late.** An observation timestamped after the watermark is almost always a device clock problem — the failure IOT-30 and IOT-31 exist to diagnose — and collapsing it into "on time" hides a real fault.
- **A watermark is a completeness heuristic, not a guarantee.** Data can always arrive later than allowed lateness. The JSDoc must say so; treating a watermark as a correctness boundary is the standard downstream mistake.
- Windowing and aggregation are the consumer's concern. This story provides the temporal classification those systems need; the zone-aware bucketing they also need is CORE-5.
- `receivedAt` should come from a trusted clock, typically the ingest server's. Documented, not enforced.

## What gmt provides (do not re-implement)

- `spanMs` from CORE-2 — lag calculation
- `bucketRange` / `floorToZone` from CORE-5 — zone-aware windowing
- `clockOffset` from IOT-30 — correcting `observedAt` from a known-skewed device
- `intervalContains` from CORE-6 — window membership

## Verification

- `observation` computes `lagMs` as `receivedAt − observedAt`
- A three-day buffered upload returns `backfilled: true`
- `lagMs` is negative when a device clock runs ahead, and this does not throw
- `watermark` over an empty list returns the sentinel
- `classifyArrival` returns `'late'` for an observation before the watermark and `'onTime'` for one after
- An observation timestamped after the watermark returns `'future'`, not `'onTime'`
- `maxOutOfOrderness` returns `0` for a strictly ordered stream
- `pnpm run validate` stays green
